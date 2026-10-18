import { readFile, writeFile } from 'node:fs/promises'
import { maintenanceHTML } from '../src/lib/i18n/maintenance'
const template = await readFile(new URL('./maintenance/in-pit.template.html', import.meta.url), 'utf8')
await writeFile(new URL('./maintenance/in-pit.html', import.meta.url), maintenanceHTML(template))
console.log('Generated standalone maintenance page from the shared Chinese and English catalogs.')
