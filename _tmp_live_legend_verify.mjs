import { chromium } from 'playwright'
const SCRATCH = '/tmp/claude-1000/-home-krish-Desktop-heatops/5a44a065-f24a-49c8-9a76-9d20d0a072e1/scratchpad'
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.setDefaultTimeout(45000)

await page.goto('https://heatops.vercel.app/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: 'Register', exact: true }).click()
await page.waitForTimeout(300)
const email = `livelegend_${Date.now()}@example.com`
await page.getByPlaceholder('Enter your name').fill('LiveLegend')
await page.getByPlaceholder('your@email.com').fill(email)
await page.locator('input[type=password]').fill('Passw0rd!')
await page.getByRole('button', { name: 'CREATE ACCOUNT', exact: true }).click()
await page.waitForTimeout(800)
await page.getByPlaceholder('your@email.com').fill(email)
await page.locator('input[type=password]').fill('Passw0rd!')
await page.getByRole('button', { name: 'SIGN IN', exact: true }).click()
await page.getByPlaceholder('Search any city in India...').waitFor({ state: 'visible', timeout: 30000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${SCRATCH}/live_heatwave_legend.png` })
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('Legend contains "Active heatwave (major states)":', bodyText.includes('Active heatwave (major states)'))
console.log('errors:', JSON.stringify(errors.slice(0, 10)))
await browser.close()
