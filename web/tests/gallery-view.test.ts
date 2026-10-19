import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PhotoGallery from '../src/components/PhotoGallery'
import { LocaleProvider } from '../src/components/Localized'
import type { GalleryAlbum } from '../src/lib/gallery'
const album: GalleryAlbum = {id:1,slug:'fixture',title:'',date:'2025-01-17',description:'',photos:[{id:1,src:'/fixture.png',display:'/fixture.png',thumbnail:'/fixture.png',width:640,height:800,alt:'Fixture',caption:'',video:false}]}
const render = (data: GalleryAlbum[], locale: 'en'|'zh-CN' = 'zh-CN') => renderToStaticMarkup(h(LocaleProvider,{locale},h(PhotoGallery,{albums:data})))
test('new gallery uses revised copy, real counts and no invented empty captions or settings',()=>{
 const html=render([album])
 assert.doesNotMatch(html,/多数时候是我在里面|不是每个周五都有/)
 assert.match(html,/过往的周五/)
 assert.match(html,/一共攒了 1 期/)
 assert.doesNotMatch(html,/没写字|没记参数|No caption|No settings|@i18n:/)
 assert.match(render([album],'en'),/1 set since January 17, 2025/)
 assert.doesNotThrow(()=>render([{...album,date:''}]))
})
test('film metadata omits digital readings; video-only albums remain accessible in the archive',()=>{
 const film={...album,photos:[{...album.photos[0],exposure:{medium:'film' as const,camera:'Fixture Camera',filmStock:'Fixture Film',iso:400,shutter:'1/125',aperture:'2.8'}}]}
 const html=render([film])
 assert.match(html,/Fixture Camera/)
 assert.match(html,/Fixture Film/)
 assert.doesNotMatch(html,/1\/125|ƒ\/2.8|>400</)
 const video=render([{...album,photos:[{...album.photos[0],video:true}]}])
 assert.match(video,/ff-row/)
 assert.doesNotMatch(video,/暂时还没有记录/)
})

test('end credits merge confirmed aliases within each role',()=>{
 const names=['FurryPorridge','稀饭','熙帆','XwHuan14708','妄欢','完蛋了我忘了(╥_╥)','Mr_Qingning']
 const data=names.map((name,index)=>({...album,id:index+1,slug:`fixture-${index}`,description:`🥩 @${name}\n📷 @${name}`}))
 const html=render(data).split('class="ff-thanks"')[1].split('class="ff-end-legal"')[0]
 assert.doesNotMatch(html,/FurryPorridge|稀饭|XwHuan14708|完蛋了我忘了/)
 for(const name of ['熙帆','妄欢','Mr_Qingning']) assert.equal(html.split(`>${name}</span>`).length-1,2)
})
