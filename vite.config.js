import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs-extra'

const __dirname = path.resolve()

export default defineConfig(({ command }) => {
  // Determine if we're in production build mode
  const isProd = command === 'build'
  
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    plugins: [
      vue(),
      {
        name: 'handle-extension-files',
        closeBundle: async () => {
          try {
            // Ensure dist directory exists
            await fs.ensureDir('dist')
            
            // Create src/sidepanel directory in dist
            await fs.ensureDir('dist/src/sidepanel')
            
            // Move files to correct location
            if (await fs.pathExists('dist/index.html')) {
              await fs.move('dist/index.html', 'dist/src/sidepanel/index.html', { overwrite: true })
            }
            
            // Move assets if they exist
            if (await fs.pathExists('dist/assets')) {
              await fs.move('dist/assets', 'dist/src/sidepanel/assets', { overwrite: true })
            }

            // Copy static files
            await fs.copy('manifest.json', 'dist/manifest.json')
            await fs.copy('background.js', 'dist/background.js')
            
            // Copy public folder contents
            if (await fs.pathExists('public')) {
              if (await fs.pathExists('public/icons')) {
                await fs.copy('public/icons', 'dist/icons')
              }
              const publicFiles = await fs.readdir('public')
              for (const file of publicFiles) {
                if (file !== 'icons') {
                  await fs.copy(`public/${file}`, `dist/${file}`)
                }
              }
            }

            console.log('Extension files processed successfully')
          } catch (err) {
            console.error('Error processing extension files:', err)
            throw err
          }
        }
      }
    ],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      assetsDir: '.',
      rollupOptions: {
        input: {
          sidepanel: path.resolve(__dirname, 'src/sidepanel/index.html')
        },
        output: {
          entryFileNames: 'src/sidepanel/[name].js',
          chunkFileNames: 'src/sidepanel/[name].js',
          assetFileNames: 'src/sidepanel/[name].[ext]'
        }
      }
    },
    publicDir: 'public',
    server: {
      port: 3100,
      open: '/sidepanel.html' // Auto-open sidepanel page
    },
    define: isProd ? {
      // In production builds, replace environment variables with empty values
      // to ensure they don't get inlined
      'import.meta.env.VITE_OPENAI_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_CUSTOMIZED_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_DEEPSEEK_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(''),
      'import.meta.env.VITE_AZURE_SPEECH_KEY': JSON.stringify(''),
      'import.meta.env.VITE_AZURE_SPEECH_REGION': JSON.stringify('')
    } : {}
  }
})
