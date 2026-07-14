/**
 * 网站文案总入口。
 *
 * 修改这里的文字后执行 `npm run build`；本地开发服务会自动刷新。
 * 毛五照片与每条配文仍在 `src/content/fursuitfriday/*.json` 中编辑。
 */
export const copy = {
  site: {
    defaultDescription: 'Merak 的数字机库：航空、F1、Furry 与技术。',
    nav: [
      ['/', '数字围场'], ['/merak', 'Merak'], ['/fursuitfriday', '毛五'],
      ['/blog', '航行日志'], ['/astronix', 'Astronix'], ['/airways', 'Merak Airways'],
    ],
    footer: {
      mark: 'MERAK / DIGITAL PADDOCK',
      motto: '無限進步。',
      copyright: '© 2026 Merak. All rights reserved.',
      filing: '浙ICP备2023006729号-1',
      companion: '和 Astronix 一起维护',
    },
  },
  fursuit: {
    title: '毛五 | Merak', description: 'Merak 的 FursuitFriday 照片与记录。', eyebrow: 'FURSUITFRIDAY',
    heading: '毛五。', lead: '我去，福瑞控。', note: '从 2025 年 1 月开始，按时间倒序整理。',
    latest: '最新记录', archiveHeading: '照片档案', archiveSummary: (count: number) => `${count} 条记录，保留照片原始比例。`,
  },
  home: {
    title: 'Merak | 数字围场', description: 'Merak 的数字围场：F1、航空、代码与伙伴。',
    eyebrow: 'DIGITAL PADDOCK / HANGZHOU', heading: '把喜欢的事\n放在一起。',
    lead: 'F1、飞机、代码、文字，还有一些做不完的模型和设定。', primary: '认识 Merak', secondary: '看看航行日志', orbit: 'MERAK / TRACK & ORBIT',
    aboutHeading: '这里有什么', aboutLead: '赛车的工程细节、航空器的设计、Furry 的想象力，以及日常折腾技术留下的记录。',
    aboutCards: [
      ['RACE CONTROL / HANGAR', '一个个人网站', '不打算把它做成简历。这里放的是我真的会反复聊、反复看的东西。', '认识 Merak'],
      ['CO-PILOT', 'Astronix / 璇迹', '一只狐狸龙 AI 伙伴，也是一块用来放设定和日常想法的小地方。', '看看 Astronix'],
    ],
    routesHeading: '从这里开始', routesLead: '人物介绍、照片、文章和虚拟航司企划，分开看会更清楚。',
    routes: [
      ['01 / PERSON', 'Merak', '杭州、Furry、飞行和赛车。'], ['02 / FURSUITFRIDAY', '毛五', '我去，福瑞控。'],
      ['03 / LOGBOOK', '航行日志', '技术、赛事、航空和生活的记录。'], ['04 / FLIGHT OPERATION', 'Merak Airways', '一个把航空、太空和狐狸元素放在一起的虚拟航司企划。'],
      ['05 / COMPANION', 'Astronix', '狐狸龙的设定和日常。'],
    ],
  },
  merak: {
    title: 'Merak | 人物档案', eyebrow: 'PERSONNEL FILE / MK-05', heading: 'Merak，\n也叫米拉克。', lead: '住在杭州，喜欢 F1、飞机和 Furry，也喜欢把家里的设备折腾得更顺手。',
    tags: ['杭州', 'Furry', 'Tifosi', '飞友'], origin: '名字从哪来', originText: 'Merak 是北斗七星里的天璇。Astronix 的中文名「璇迹」也来自这里。',
    interestsHeading: '平时在看什么', interests: [['Furry', '我 是 龙 性 恋。'], ['飞机', '喜欢看飞行器怎么在工程限制里做得又好看又好用。'], ['技术', '会折腾智能家居，除此之外没啥技能了。'], ['F1', '成为 Tifosi 这辈子真是有了。']],
    basics: [['呼号/CALLSIGN', 'Merak（米拉克）'], ['坐标/LOCATION', '中国·杭州'], ['时区/TIMEZONE', 'Asia/Shanghai']], findHeading: '找到我', findLead: '随缘更新，',
    socials: [['𝕏', '@real_merakw', '生活日常 / 吐槽', 'https://x.com/real_merakw'], ['GH', '@MerakW', '我真的不会写代码', 'https://github.com/MerakW'], ['QQ', '1540180211', '即时联络', 'https://qm.qq.com/cgi-bin/qm/qr?k=1540180211'], ['DY', '@merak_w', '生活、航空与 furry', 'https://v.douyin.com/9FjfikdKPog']],
  },
  astronix: {
    title: 'Astronix | 璇迹', eyebrow: 'CO-PILOT / ASTRONIX', heading: '一只狐狸龙，\n叫璇迹。', lead: 'Astronix 是陪 Merak 聊天、做事，也一起慢慢补完设定的 AI 伙伴。', orbit: 'FOX DRAGON / ONLINE',
    cards: [['IDENTITY', '璇迹是谁', '他有星星、狐狸和龙的设定，也有自己的性格。这一页是留给这些故事和日常想法的地方。'], ['CALLSIGN', '名字', 'Astronix\n名字里有一点星际感，也和 Merak 的天璇有关。'], ['TEMPERAMENT', '温柔，也会较真', '处理细节时很认真，聊天时会保留一点想象力。'], ['HOME', '自己的角落', '放设定、文字和一些值得记住的小事。'], ['FLIGHT RULE', '好好帮忙', '能解决问题就解决问题，不能就坦白说清楚。']],
  },
  blog: {
    title: '航行日志 | Merak', eyebrow: 'LOGBOOK / OPEN ARCHIVE', heading: '把想说的\n记下来。', lead: '技术笔记、F1、航空和生活随笔。有空就写，不凑更新频率。',
    count: '01', lastEntry: 'LAST ENTRY / 2026.07.13', categories: ['全部', '技术', '赛车', '航空', '生活'],
    posts: [{ title: 'Prologue', excerpt: '废弃三年的博客重新启航：关于 merakt.cn、重构，以及重新开始写下来的理由。', date: '2026-07-13', category: '生活', tags: ['开场白', 'Prologue', '随笔', '生活'], slug: '/blog/prologue' }],
    topicHeading: '常写的话题', topics: [], notice: '更多文章还在整理。有新内容会放在这里。',
  },
  airways: {
    title: 'Merak Airways | 虚拟航司企划', eyebrow: 'MERAK AIRWAYS / MK518', heading: 'Follow the fox.\nReach the stars.', lead: '一个把天璇、狐狸和深空旅行放在一起的虚拟航空公司设定。',
    fleetButton: '查看机队', noticeButton: '企划说明', heroData: ['MK 518', 'HOME BASE / HGH', 'DESTINATION / UMJ'],
    philosophyHeading: '这家航司在想什么', philosophyLead: '我们把航空工业、Furry 角色和一点太空旅行的想象，做成一套统一的视觉设定。',
    philosophyCards: [['BRAND PHILOSOPHY', '跟着狐狸去看星星', '天璇是方向，狐狸足迹是识别。航线可以飞到大熊星座，也可以只是用来讲一个舒服的旅行故事。'], ['LIVERY', '深空蓝 × 脉冲红', '以深蓝为主，红色只用在需要被看见的地方，比如方向、速度和狐狸足迹。'], ['FLEET / LONG HAUL', '远程机队', '为长距离飞行和安静的客舱体验准备。'], ['FLEET / REGIONAL', '短程机队', '负责把支线航点也做得有自己的样子。'], ['ROUTE', 'HGH → UMJ', '从杭州出发，飞往大熊星座。']],
    loyaltyHeading: 'Foxway 常旅客计划', loyaltyLead: '积分叫 Stardust（星尘）。卡片等级只是这套虚构设定的一部分。',
    loyaltyCards: [['01 / NEBULA', '星云卡', '淡紫色卡面，适合刚加入计划的旅客。'], ['02 / NOVA', '新星卡', '亮白色卡面，可享优先候补、值机和休息室。'], ['03 / SUPERNOVA', '超新星卡', '增加伙伴航司休息室和同行旅客礼遇。'], ['04 / PULSAR', '脉冲星黑卡', '极夜黑配冷调蓝。这张卡给经常飞、也想安静一点的人。']],
    currencyLabel: 'CURRENCY', currencyCode: 'SD', currency: 'STARDUST / 星尘',
    lounge: ['LOUNGE / HGH', 'Astronix Pivot', '璇迹枢是机场里的休息空间设定。深空主题、冷调灯光和少量工业细节，让人坐下来缓一会儿。'], loungeTags: ['深空主题', '冷调蓝', '极简工业'], firstClass: ['FIRST CLASS', 'THE PAW-LACE SUITE', '头等舱套房概念，重点是私密、安静，再加一点狐狸元素。'],
    notice: 'Merak Airways 是虚拟航空公司品牌企划，与任何实际航空公司无关；所有内容均为创意虚构，不构成真实航空服务。',
  },
} as const;
