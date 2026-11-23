// Entry point: run on real G2 / simulator when the Even bridge is
// present, otherwise fall back to the browser preview (GitHub Pages demo
// and local testing without glasses).
// The bridge is resolved exactly once here and passed in — awaiting
// waitForEvenAppBridge() a second time inside the adapter is unreliable.
import { GlanceApp } from './app'
import { runOnGlasses } from './g2'
import { runPreview } from './preview'
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk'

const app = new GlanceApp()

async function main(): Promise<void> {
  const bridge = await Promise.race([
    waitForEvenAppBridge().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
  ])
  if (bridge) {
    await runOnGlasses(app, bridge)
  } else {
    runPreview(app)
  }
}

void main()
