import { HEX_PATTERN, cellWidth, oklch, padCells, virtualFrequency } from './pit-lane'

/**
 * Garage mails styled as an F1 race-control message: flag banner, livery hero, team radio, timing sheet,
 * chequered footer. Table layout + inline styles only, so Gmail / Outlook / QQ Mail / Apple Mail agree.
 */
export type GarageMail = 'approved' | 'invite' | 'reset'
/** Applicant notices: receipt after a web application, then the review result for those who asked. */
export type NoticeMail = 'received' | 'live' | 'rejected'
export type PitMail = GarageMail | NoticeMail
export type GarageMailFriend = { tla: string; name: string; teamColor?: string | null; bay?: number | null }
export type PitMailExtra = { ticket?: string; note?: string | null; account?: boolean; notify?: boolean }

const BODY = `-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Segoe UI',Arial,sans-serif`
const MONO = `'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace`
const DISPLAY = `Formula1,'Arial Black','Helvetica Neue',Arial,sans-serif`
const escapeHTML = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
const stamp = (now: number) => `${new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now)} UTC+8`

export function garageMail(kind: PitMail, friend: GarageMailFriend, link: string, now = Date.now(), extra: PitMailExtra = {}) {
  const tla = friend.tla, name = `${friend.name} · ${tla}`, time = stamp(now)
  const livery = friend.teamColor && HEX_PATTERN.test(friend.teamColor) ? friend.teamColor : '#2349ed'
  // Very dark liveries vanish on the night-black hero; keep the stripe, light the lettering.
  const ink = oklch(livery).l < 0.5 ? '#f2f5fb' : livery
  const bay = friend.bay ? `P${String(friend.bay).padStart(2, '0')}` : '待分配 / TBA'
  const copy = {
    approved: {
      subject: `PIT LANE · ${tla} 已获准进站 / Clearance granted`, flag: '#2fd07b', chip: 'GREEN FLAG', banner: 'RACE CONTROL · PIT ENTRY OPEN',
      title: 'PIT ENTRY CLEARED', titleZh: '已获准进站', radio: 'Box, box. 卷帘门已拉起，欢迎进站。',
      zh: [`${name}，你的友链申请已通过，维修区卷帘门已拉起。`, '车队后台现已开放，可以用申请时填写的邮箱和密码登录，自行修改简介、留言、涂装色和维修状态。'],
      en: [`${name}: your Pit Lane application is approved.`, 'Your team garage is now open — sign in with the email and password from your application.'],
      sheet: [['STATUS 状态', 'APPROVED · 已通过'], ['BAY 车位', bay], ['GARAGE 后台', 'OPEN · 已开放'], ['LOGIN 登录', '申请邮箱 + 密码']],
      action: '登录车队后台 / Sign in',
    },
    invite: {
      subject: `PIT LANE · ${tla} 车队后台已开通 / Garage access`, flag: '#2f7fe0', chip: 'PIT EXIT', banner: 'RACE CONTROL · GARAGE ACCESS',
      title: 'GARAGE ACCESS', titleZh: '车队后台已开通', radio: 'The garage is yours. 钥匙在下面。',
      zh: [`${name}，Merak 为你开通了 PIT LANE 车队后台。`, '请在 72 小时内点上面的按钮设置密码，之后就能自行管理你的友链卡片。'],
      en: [`${name}: Merak has opened a Pit Lane team garage for you.`, 'Set your password within 72 hours using the button above.'],
      sheet: [['STATUS 状态', 'ACCESS GRANTED · 已开通'], ['ISSUED 签发', time], ['VALID 有效期', '72 H'], ['NEXT 下一步', '设置密码']],
      action: '设置密码 / Set password',
    },
    reset: {
      subject: `PIT LANE · ${tla} 重置密码 / Password reset`, flag: '#ffd400', chip: 'YELLOW FLAG', banner: 'RACE CONTROL · SECURITY CHECK',
      title: 'PASSWORD RESET', titleZh: '重置密码', radio: 'Copy that. 收到重置请求。',
      zh: [`${name}，有人请求重置你的车队后台密码。`, '链接 1 小时内有效；如果不是你本人操作，忽略这封邮件即可，原密码不会改变。'],
      en: [`${name}: a password reset was requested for your team garage.`, 'The link is valid for 1 hour; ignore this email if it was not you — your password stays the same.'],
      sheet: [['REQUEST 请求', time], ['VALID 有效期', '1 H'], ['NOT YOU? 非本人', '忽略即可']],
      action: '重置密码 / Reset password',
    },
    received: {
      subject: `PIT LANE · ${tla} 申请已受理 / Application received`, flag: '#e8962a', chip: 'IN REVIEW', banner: 'RACE CONTROL · CLEARANCE REQUESTED',
      title: 'CLEARANCE REQUESTED', titleZh: '申请已开始受理', radio: 'Copy, request received. 申请已送达干事席。',
      zh: [`${name}，你的 P 房入驻申请已送达干事席，审核已经开始。`, extra.notify ? '审核有结果后会再发邮件通知你；也可以随时用申请编号查询进度。' : '审核通过后会再发邮件通知你登录车队后台；也可以随时用申请编号查询进度。'],
      en: [`${name}: your Pit Lane application has reached the stewards and review has started.`, extra.notify ? 'We will email you again once there is a decision; you can also check progress with your ticket at any time.' : 'We will email you when your team garage opens; you can also check progress with your ticket at any time.'],
      sheet: [['TICKET 申请编号', extra.ticket || '—'], ['STATUS 状态', 'PENDING · 审核中'], ['SUBMITTED 提交', time], ['GARAGE 后台', extra.account ? '已创建 · 通过后开放' : '未创建']],
      action: '查询进度 / Check status',
    },
    live: {
      subject: `PIT LANE · ${tla} 已获准进站 / Clearance granted`, flag: '#2fd07b', chip: 'GREEN FLAG', banner: 'RACE CONTROL · PIT ENTRY OPEN',
      title: 'PIT ENTRY CLEARED', titleZh: '已获准进站', radio: 'Box, box. 卷帘门已拉起，欢迎进站。',
      zh: [`${name}，你的友链申请已通过，P 房已经上线。`, '现在就能在 Pit Lane 发车格上看到你的车队，欢迎常来维修区坐坐。'],
      en: [`${name}: your Pit Lane application is approved and your garage is live.`, 'Your team is now on the Pit Lane grid — drop by any time.'],
      sheet: [['STATUS 状态', 'APPROVED · 已通过'], ['BAY 车位', bay], ['LIVE 上线', time]],
      action: '查看 P 房 / View the grid',
    },
    rejected: {
      subject: `PIT LANE · ${tla} 申请结果 / Application update`, flag: '#e5304a', chip: 'NOT CLEARED', banner: 'RACE CONTROL · STEWARDS DECISION',
      title: 'NOT CLEARED', titleZh: '本次暂未通过', radio: 'Unlucky this time. 这次没能进站。',
      zh: [`${name}，很遗憾，你的友链申请这次暂未通过。`, extra.note ? `干事备注：${extra.note}` : '调整后可以随时重新申请。'],
      en: [`${name}: your Pit Lane application was not approved this time.`, extra.note ? 'See the stewards’ note above; you are welcome to apply again.' : 'You are welcome to adjust and apply again.'],
      sheet: [['STATUS 状态', 'NOT CLEARED · 暂未通过'], ['DECIDED 审核', time], ...(extra.ticket ? [['TICKET 申请编号', extra.ticket]] : [])],
      action: '重新申请 / Apply again',
    },
  }[kind]
  const frequency = `${virtualFrequency(tla)} MHz`
  const radioHead = `TEAM RADIO · MERAK → ${tla} · ${frequency}`
  const home = new URL('/pit-lane', link).href
  const width = Math.max(...copy.sheet.map(([label]) => cellWidth(label)))

  const text = [
    `${copy.chip} · ${copy.banner}`, `HGH APRON & PIT LANE · ${tla}`, '', `${copy.title} — ${copy.titleZh}`, '',
    radioHead, `“${copy.radio}”`, '', ...copy.zh, '',
    ...copy.sheet.map(([label, value]) => `${padCells(label, width)}  ${value}`), '',
    ...copy.en, '', `${copy.action}: ${link}`, '',
    `— Merak · 数字围场 · ${home}`, '这是一封自动发送的邮件，请勿直接回复。 / This mailbox is not monitored.',
  ].join('\n')

  const e = escapeHTML
  const cell = (style: string, content: string, attrs = '') => `<td ${attrs} style="${style}">${content}</td>`
  const chequer = Array.from({ length: 2 }, (_, row) => `<tr>${Array.from({ length: 40 }, (_, col) => `<td bgcolor="${(row + col) % 2 ? '#ffffff' : '#0d121b'}" style="height:7px;line-height:7px;font-size:0">&nbsp;</td>`).join('')}</tr>`).join('')
  const sheet = copy.sheet.map(([label, value], index) => `<tr>${cell(`padding:10px 14px;${index ? 'border-top:1px solid #e3e7ee;' : ''}font:11px/1.4 ${MONO};letter-spacing:.06em;color:#6b7280;width:42%`, e(label))}${cell(`padding:10px 14px;${index ? 'border-top:1px solid #e3e7ee;' : ''}font:600 13px/1.4 ${MONO};color:#15171c`, e(value))}</tr>`).join('')
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>@media (max-width:520px){.rc-mid{display:none!important}.hero-tla{font-size:60px!important}.px{padding-left:22px!important;padding-right:22px!important}}</style><title>${e(copy.subject)}</title></head>
<body style="margin:0;padding:0;background:#e9edf4;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${e(`${copy.radio} ${copy.zh[1]}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#e9edf4"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;border-radius:10px;overflow:hidden;border-collapse:separate">

<tr><td bgcolor="#0d121b" style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
${cell(`padding:11px 16px;background:#141b27;border-right:1px solid #1e2838;font:600 11px/1 ${MONO};letter-spacing:.08em;color:#ffffff;white-space:nowrap`, `<span style="display:inline-block;width:16px;height:10px;margin-right:9px;vertical-align:-1px;border-radius:1px;background:${copy.flag}"></span>${e(copy.chip)}`, 'bgcolor="#141b27"')}
${cell(`padding:11px 14px;font:11px/1.3 ${MONO};letter-spacing:.08em;color:#7d8aa0`, e(copy.banner), 'class="rc-mid"')}
${cell(`padding:11px 16px;font:11px/1 ${MONO};letter-spacing:.04em;color:#c3cddd;white-space:nowrap`, e(time), 'align="right"')}
</tr></table></td></tr>

<tr><td bgcolor="#0a0f19" style="padding:0;background:#0a0f19 repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 12px,transparent 12px 40px)"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td width="10" bgcolor="${livery}" style="width:10px;background:${livery};font-size:0">&nbsp;</td><td width="3" bgcolor="#ffd400" style="width:3px;background:#ffd400;font-size:0">&nbsp;</td>
<td style="padding:28px 28px 30px">
<div style="font:600 11px/1 ${MONO};letter-spacing:.16em;color:#7f95ff">HGH APRON &amp; PIT LANE · BAY ${e(bay.split(' ')[0])}</div>
<div class="hero-tla" style="margin:16px 0 4px;font:italic 900 76px/.95 ${BODY};letter-spacing:-.02em;color:${ink}">${e(tla)}</div>
<div style="font:700 19px/1.4 ${BODY};color:#f2f5fb">${e(friend.name)}</div>
<div style="margin-top:22px;padding-top:16px;border-top:1px solid #1e2838">
<span style="font:700 21px/1.2 ${DISPLAY};letter-spacing:.03em;color:#ffffff;text-transform:uppercase">${e(copy.title)}</span>
<span style="display:inline-block;width:8px;height:8px;margin-left:8px;background:${copy.flag};vertical-align:2px"></span>
<div style="margin-top:4px;font:14px/1.4 ${BODY};color:#93a1b8">${e(copy.titleZh)}</div></div>
</td></tr></table></td></tr>

<tr><td class="px" style="padding:28px 32px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="border-left:3px solid ${livery};padding:2px 0 2px 14px">
<div style="font:600 10.5px/1.4 ${MONO};letter-spacing:.1em;color:#6b7280">${e(radioHead)}</div>
<div style="margin-top:6px;font:italic 600 18px/1.5 ${BODY};color:#15171c">“${e(copy.radio)}”</div>
</td></tr></table></td></tr>

<tr><td class="px" style="padding:18px 32px 0;font:15px/1.8 ${BODY};color:#15171c">${copy.zh.map(line => `<p style="margin:0 0 10px">${e(line)}</p>`).join('')}</td></tr>

<tr><td class="px" style="padding:10px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#ffd400" style="border-radius:4px;background:#ffd400"><a href="${e(link)}" target="_blank" style="display:inline-block;padding:14px 24px;font:700 15px/1 ${BODY};letter-spacing:.02em;color:#111111;text-decoration:none">${e(copy.action)} &rarr;</a></td>
</tr></table></td></tr>

<tr><td class="px" style="padding:24px 32px 0">
<div style="margin-bottom:8px;font:600 10.5px/1 ${MONO};letter-spacing:.14em;color:#9ca3af">TIMING SHEET</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e3e7ee;border-collapse:separate;border-radius:6px">${sheet}</table>
</td></tr>

<tr><td class="px" style="padding:22px 32px 0;font:13px/1.7 ${BODY};color:#6b7280">${copy.en.map(line => `<p style="margin:0 0 6px">${e(line)}</p>`).join('')}</td></tr>

<tr><td class="px" style="padding:14px 32px 30px;font:12px/1.6 ${BODY};color:#9ca3af">按钮无法点击时，复制链接到浏览器打开 / If the button does not work, open:<br><a href="${e(link)}" target="_blank" style="color:#2349ed;word-break:break-all">${e(link)}</a></td></tr>

<tr><td style="padding:0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed">${chequer}</table></td></tr>
<tr><td class="px" bgcolor="#0d121b" style="padding:18px 32px 20px">
<div style="font:600 11px/1.4 ${MONO};letter-spacing:.12em;color:#c3cddd">MERAK · 数字围场 &nbsp;<span style="color:#e10600">◆</span>&nbsp; <a href="${e(home)}" target="_blank" style="color:#c3cddd;text-decoration:none">MERAKT.CN/PIT-LANE</a></div>
<div style="margin-top:6px;font:12px/1.6 ${BODY};color:#7d8aa0">这是一封自动发送的邮件，请勿直接回复。 This mailbox is not monitored.</div>
</td></tr>

</table></td></tr></table></body></html>`
  return { subject: copy.subject, text, html }
}
