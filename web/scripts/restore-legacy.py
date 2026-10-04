#!/usr/bin/env python3
"""Restore reviewed Legacy content through the CMS API; no database copying."""
import argparse
from datetime import datetime
import getpass
from html.parser import HTMLParser
import json
import mimetypes
from pathlib import Path
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request


class Element:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []


class ArticleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = Element(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in {'br', 'img', 'hr', 'meta', 'link', 'input'}:
            self.stack.append(node)

    def handle_endtag(self, tag):
        if len(self.stack) > 1 and self.stack[-1].tag == tag:
            self.stack.pop()

    def handle_data(self, value):
        self.stack[-1].children.append(value)


def elements(node):
    yield node
    for child in node.children:
        if isinstance(child, Element):
            yield from elements(child)


def text_content(node):
    return ''.join(child if isinstance(child, str) else text_content(child) for child in node.children).strip()


def lexical(node, number=1):
    if isinstance(node, str):
        if not node.strip():
            return None
        return {'type': 'text', 'version': 1, 'text': node, 'format': 0, 'detail': 0, 'mode': 'normal', 'style': ''}
    children = [item for child in node.children if (item := lexical(child)) is not None]
    if node.tag in {'strong', 'b', 'em', 'i', 'del', 's'}:
        flag = {'strong': 1, 'b': 1, 'em': 2, 'i': 2, 'del': 4, 's': 4}[node.tag]
        def format_text(item):
            if item['type'] == 'text':
                item['format'] |= flag
            for child in item.get('children', []):
                format_text(child)
        for item in children:
            format_text(item)
        return {'type': '_inline', 'children': children}
    # Flatten inline wrappers while preserving formatting.
    children = [part for item in children for part in (item['children'] if item['type'] == '_inline' else [item])]
    common = {'version': 1, 'children': children, 'direction': None, 'format': '', 'indent': 0}
    if node.tag == 'p':
        return {**common, 'type': 'paragraph', 'textFormat': 0, 'textStyle': ''}
    if re.fullmatch(r'h[1-6]', node.tag):
        return {**common, 'type': 'heading', 'tag': node.tag}
    if node.tag in {'ul', 'ol'}:
        for i, item in enumerate(children, 1):
            item['value'] = i
        return {**common, 'type': 'list', 'tag': node.tag, 'listType': 'bullet' if node.tag == 'ul' else 'number', 'start': 1}
    if node.tag == 'li':
        return {**common, 'type': 'listitem', 'value': number}
    if node.tag == 'a':
        url = node.attrs.get('href', '')
        if not (url.startswith('/') and not url.startswith('//') or re.match(r'https?://', url)):
            raise ValueError('文章包含不支持的链接类型')
        return {**common, 'type': 'link', 'version': 3, 'fields': {'url': url, 'linkType': 'custom', 'newTab': False}}
    if node.tag == 'br':
        return {'type': 'linebreak', 'version': 1}
    raise ValueError('文章正文包含未支持的标签：' + node.tag)


def sources(legacy):
    public = (legacy / 'public').resolve()
    galleries = []
    for file in sorted((legacy / 'src/content/fursuitfriday').glob('*.json')):
        row = json.loads(file.read_text())
        if not re.fullmatch(r'\d+', row.get('tweetId', '')) or not re.fullmatch(r'/images/fursuitfriday/[A-Za-z0-9_.-]+', row.get('image', '')):
            raise ValueError('无效毛五记录：' + file.name)
        image = public / row['image'].lstrip('/')
        if image.is_symlink() or not image.resolve().is_relative_to(public) or not image.is_file():
            raise ValueError('图片不存在或路径不安全：' + file.name)
        datetime.fromisoformat(row['time'].replace('Z', '+00:00'))
        if not isinstance(row.get('caption'), str):
            raise ValueError('毛五记录缺少配文：' + file.name)
        galleries.append((row, image))
    posts = []
    for file in sorted((legacy / 'src/pages/blog').glob('*.astro')):
        source = file.read_text()
        source = re.sub(r'^---\s*\n.*?\n---\s*\n', '', source, count=1, flags=re.S)
        parser = ArticleParser()
        parser.feed(source)
        nodes = list(elements(parser.root))
        body = next((n for n in nodes if 'post-body' in n.attrs.get('class', '').split()), None)
        title = next((text_content(n) for n in nodes if n.tag == 'h1'), None)
        date = next((re.search(r'(\d{4})\.(\d{2})\.(\d{2})', text_content(n)) for n in nodes if 'eyebrow' in n.attrs.get('class', '').split()), None)
        if not body or not title or not date or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', file.stem):
            raise ValueError('无法可靠转换文章：' + file.name)
        blocks = [item for child in body.children if (item := lexical(child)) is not None]
        if any(item['type'] in {'text', '_inline'} for item in blocks):
            raise ValueError('文章正文包含未分段内容：' + file.name)
        description = next((n.attrs['description'] for n in nodes if 'description' in n.attrs), '')
        posts.append({'title': title, 'slug': file.stem, 'date': '-'.join(date.groups()) + 'T00:00:00+08:00',
                      'category': '生活', 'excerpt': description,
                      'body': {'root': {'type': 'root', 'version': 1, 'direction': None, 'format': '', 'indent': 0, 'children': blocks}}})
    if not galleries and not posts:
        raise ValueError('没有找到可恢复内容；--legacy 应指向 Legacy/astro-site')
    return galleries, posts


class CMS:
    def __init__(self, site):
        self.site, self.token = site, None
        # Do not follow redirects with credentials, tokens or content uploads.
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None
        self.opener = urllib.request.build_opener(NoRedirect())

    def request(self, path, data=None, content_type='application/json'):
        headers = {'Accept': 'application/json'}
        if self.token:
            headers['Authorization'] = 'JWT ' + self.token
        if data is not None:
            headers['Content-Type'] = content_type
            if isinstance(data, dict):
                data = json.dumps(data, ensure_ascii=False).encode()
        request = urllib.request.Request(self.site + '/api/' + path, data=data, headers=headers)
        try:
            with self.opener.open(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Never echo response bodies: they can contain credentials or content.
            raise RuntimeError(f'CMS HTTP {error.code}：{path.split("?")[0]}；已停止，请检查后台和服务日志') from None

    def find(self, collection, field, value):
        query = urllib.parse.urlencode({f'where[{field}][equals]': value, 'limit': 1, 'depth': 0})
        docs = self.request(collection + '?' + query).get('docs', [])
        return docs[0] if docs else None

    def upload(self, file, metadata):
        boundary = 'merak-' + secrets.token_hex(16)
        mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
        if '\r' in file.name or '\n' in file.name or '"' in file.name:
            raise ValueError('不安全的上传文件名')
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="_payload"\r\n\r\n'.encode(),
                 json.dumps(metadata, ensure_ascii=False).encode(),
                 f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file.name}"\r\nContent-Type: {mime}\r\n\r\n'.encode(),
                 file.read_bytes(), f'\r\n--{boundary}--\r\n'.encode()]
        return self.request('media', b''.join(parts), 'multipart/form-data; boundary=' + boundary)['doc']


def main():
    parser = argparse.ArgumentParser(description='预览或批量恢复 Legacy 毛五与文章；不复制数据库，不覆盖已有记录。')
    parser.add_argument('--legacy', type=Path, required=True, help='本机旧站 astro-site 目录')
    parser.add_argument('--site', help='云端正式 HTTPS 源地址，例如 https://merakt.cn')
    parser.add_argument('--apply', action='store_true', help='上传图片并写入云端；执行前请备份云端 /opt/merak/data')
    parser.add_argument('--publish', action='store_true', help='将新导入内容公开发布；默认导入草稿及私有媒体')
    args = parser.parse_args()
    galleries, posts = sources(args.legacy.expanduser().resolve())
    print(f'旧站输入核实：{len(galleries)} 条毛五、{len(posts)} 篇文章；图片文件均存在。')
    print('只创建媒体、相册和文章；按 legacyId / legacyPath / slug 去重，已有内容保持原样。')
    if not args.apply:
        print('未连接云端、未上传、未写入。确认备份后加 --site https://merakt.cn --apply；需要直接公开再加 --publish。')
        return
    site = urllib.parse.urlsplit(args.site or '')
    if site.scheme != 'https' or not site.hostname or site.username or site.password or site.path not in ('', '/') or site.query or site.fragment:
        raise ValueError('--site 必须是无凭据、无路径的 HTTPS 源地址')
    if any(c.isspace() for c in args.site):
        raise ValueError('--site 不能包含空白')
    cms = CMS(args.site.rstrip('/'))
    email = input('云端管理员邮箱：').strip()
    password = getpass.getpass('云端管理员密码（不显示、不保存）：')
    login = cms.request('users/login', {'email': email, 'password': password})
    del password
    cms.token = login.get('token')
    if not cms.token:
        raise RuntimeError('登录未返回令牌，未写入内容')
    status = 'published' if args.publish else 'draft'
    created_albums = created_posts = skipped = 0
    for index, (row, image) in enumerate(galleries, 1):
        if cms.find('albums', 'legacyId', row['tweetId']):
            skipped += 1
            continue
        credit = re.search(r'(?:📷|摄影)\s*[：:]\s*([^\n]+)', row['caption'])
        credit = credit.group(1).strip() if credit else None
        title = row['caption'].splitlines()[0] if row['caption'].strip() else '毛五 · ' + row['time'][:10]
        source = row.get('source')
        source = source if isinstance(source, str) and re.match(r'^https?://', source) else None
        media = cms.find('media', 'legacyPath', row['image'])
        if not media:
            media = cms.upload(image, {'alt': title, 'credit': credit, 'source': source,
                                      'visibility': 'public' if args.publish else 'private', 'legacyPath': row['image']})
        cms.request('albums', {'title': title, 'slug': 'ff-' + row['tweetId'], 'date': row['time'][:10],
                               'description': row['caption'], 'cover': media['id'], 'photographer': credit,
                               'legacyId': row['tweetId'], '_status': status,
                               'photos': [{'image': media['id'], 'caption': row['caption'], 'credit': credit, 'source': source}]})
        created_albums += 1
        print(f'毛五进度 {index}/{len(galleries)}（不输出配文或图片内容）', flush=True)
    for post in posts:
        if cms.find('posts', 'slug', post['slug']):
            skipped += 1
            continue
        cms.request('posts', {**post, '_status': status})
        created_posts += 1
    print(f'完成：新增相册 {created_albums}，新增文章 {created_posts}，跳过已有记录 {skipped}；状态 {status}。')
    print('请人工确认 /fursuitfriday、/blog，以及 CDN 图片访问。')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, KeyError) as error:
        print('恢复未完成：', error)
        raise SystemExit(1)
