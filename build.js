import { build } from 'vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs-extra'

const currentDir = dirname(fileURLToPath(import.meta.url))

async function buildExtension() {
  console.log('🏗️  Building Vue sidepanel...')
  
  // Build the main sidepanel
  await build({
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          sidepanel: resolve(currentDir, 'src/sidepanel/index.html')
        }
      }
    }
  })

  console.log('Copying static files...')
  
  // Copy static files
  await fs.copy('manifest.json', 'dist/manifest.json')
  await fs.copy('public/icons', 'dist/icons')
  await fs.copy('public/data', 'dist/data')
  
  console.log('Copying scripts...')

  // Copy background script
  await fs.copy('background.js', 'dist/background.js')

  // Copy content script
  await fs.copy('src/content.js', 'dist/content.js')

  // Copy content-scripts directory (for screenshot overlay)
  await fs.copy('src/content-scripts', 'dist/src/content-scripts')
  
  console.log('Processing HTML files...')
  
  // Move the built index.html to sidepanel.html
  const indexPath = 'dist/src/sidepanel/index.html'
  const sidepanelPath = 'dist/sidepanel.html'
  
  if (await fs.pathExists(indexPath)) {
    await fs.move(indexPath, sidepanelPath, { overwrite: true })
    console.log('   ✓ Moved index.html to sidepanel.html')
  } else if (await fs.pathExists('dist/index.html')) {
    await fs.move('dist/index.html', sidepanelPath, { overwrite: true })
    console.log('   ✓ Moved index.html to sidepanel.html')
  }
  
  console.log('Marking dist as a dev build (store packaging reverses this)...')
  await import('./scripts/apply-dev-manifest.js')

  console.log('Extension build complete!')
  console.log('Files in dist:')
  const files = await fs.readdir('dist')
  files.forEach(file => console.log(`   - ${file}`))
}

buildExtension().catch(err => {
  console.error('Build failed:', err)
  process.exit(1)
})
