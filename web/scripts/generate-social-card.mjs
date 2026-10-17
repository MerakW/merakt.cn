import { mkdir, copyFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const cache=resolve('.data/font-cache')
await mkdir(cache,{recursive:true})
const config=resolve('.data/social-fonts.conf')
await writeFile(config,`<?xml version="1.0"?><fontconfig><dir>${resolve('public/fonts')}</dir><dir>/System/Library/Fonts</dir><dir>/usr/share/fonts</dir><cachedir>${cache}</cachedir></fontconfig>`)
process.env.FONTCONFIG_FILE=config
const {default:sharp}=await import('sharp')
const blue='#294eff',paper='#edf2fa',ink='#101c35'
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><pattern id="checks" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 0h14v14H0zm14 14h14v14H14z" fill="${ink}"/></pattern></defs><rect width="1200" height="630" fill="${paper}"/><path d="M820 0H1200V630H646Z" fill="${blue}"/><path d="M1160 0h40v630h-40" fill="${ink}"/><path d="M48 47h26l-20 40H28zm39 0h26L93 87H67z" fill="${blue}"/><g font-family="monospace" fill="${ink}" font-size="16"><text x="136" y="72">HANGZHOU / DIGITAL PADDOCK</text><text x="48" y="386">FLIGHT LOG</text><text x="245" y="386">PHOTO LAB</text><text x="440" y="386">TEAM RADIO</text><text x="48" y="562">30° N / 120° E</text><text x="48" y="590">MERAKT.CN</text></g><path d="M48 414H594" stroke="${ink}" stroke-opacity=".25"/><path d="M48 470H108m-12-10 12 10-12 10" stroke="${blue}" stroke-width="3" fill="none"/><text x="126" y="478" fill="${ink}" font-size="21" font-family="monospace">YOU → HGH</text><g fill="white" font-family="monospace" font-size="14"><text x="857" y="73">PADDOCK ACCESS</text><text x="834" y="542">MERAK / DRIVER 51</text><text x="834" y="570">HGH · CHINA</text></g><path d="M745 630 815 478 930 478 988 351 1090 351 1160 199" stroke="white" stroke-opacity=".2" stroke-width="2" fill="none"/><circle cx="988" cy="351" r="5" fill="white"/><rect x="535" y="543" width="56" height="42" fill="url(#checks)"/><path d="M0 616H1200" stroke="${ink}" stroke-width="28"/></svg>`
const fontfile=resolve('public/fonts/Formula1-Bold.ttf')
const text=async(value,color,size,width)=>sharp({text:{text:`<span foreground="${color}">${value}</span>`,font:`Formula1 Display-Bold, Bold ${size}`,fontfile,rgba:true}}).resize({width}).png().toBuffer()
const merak=await text('MERAK',ink,130,680),number=await text('51','#ffffff',140,310)
await mkdir('public/social',{recursive:true});await mkdir('.data/cos-upload-paddock/social',{recursive:true})
await sharp(Buffer.from(svg)).composite([{input:merak,left:42,top:164},{input:number,left:807,top:210}]).png().toFile('public/social/paddock-og.png')
await copyFile('public/social/paddock-og.png','.data/cos-upload-paddock/social/paddock-og.png')
console.log(resolve('public/social/paddock-og.png'))
