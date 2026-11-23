// Even Hub SDK adapter: renders the app into one full-screen text
// container on the 576x288 monochrome display and routes glasses /
// ring events into the app state machine.
// SDK 0.0.16: long-press events exist — voice uses push-to-talk
// (LONG_PRESS start/stop); tap toggles as a fallback.
import {
  AudioInputSource,
  CreateStartUpPageContainer,
  OsEventTypeList,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk'
import { GlanceApp } from './app'

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

export async function runOnGlasses(app: GlanceApp, bridge: EvenAppBridge): Promise<void> {
  // Confirm bridge mode in the companion WebView (helps debugging and
  // tells the user where to look).
  const companion = document.getElementById('app')
  if (companion) companion.textContent = 'Telegram Glance is running on the glasses.'

  const mainText = new TextContainerProperty({
    xPosition: 0,
    yPosition: 0,
    width: 576,
    height: 288,
    borderWidth: 0,
    borderColor: 5,
    paddingLength: 4,
    containerID: 1,
    containerName: 'main',
    content: 'Telegram Glance\nLoading...',
    isEventCapture: 1,
  })

  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({ containerTotalNum: 1, textObject: [mainText] }),
  )
  console.log('[glance] createStartUpPageContainer result:', result)
  if (result !== 0) console.error('createStartUpPageContainer failed:', result)

  app.onRender = (text) => {
    void bridge
      .textContainerUpgrade(
        new TextContainerUpgrade({ containerID: 1, containerName: 'main', content: text }),
      )
      .then((ok) => console.log('[glance] textContainerUpgrade ok:', ok, 'chars:', text.length))
  }
  app.onMic = (recording) => {
    void bridge.audioControl(recording, AudioInputSource.Glasses)
  }

  const unsubscribe = bridge.onEvenHubEvent((event) => {
    const sysType = eventTypeOf(event.sysEvent)
    const textType = eventTypeOf(event.textEvent)

    // Double-tap always exits from the root page (Even Hub QA rule).
    if (
      sysType === OsEventTypeList.DOUBLE_CLICK_EVENT ||
      textType === OsEventTypeList.DOUBLE_CLICK_EVENT
    ) {
      if (app.shouldExitOnHomeDoubleTap()) {
        void bridge.shutDownPageContainer(1)
        return
      }
    }

    if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      unsubscribe()
      return
    }

    if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      void app.handle('doubletap')
      return
    }
    // Long press arrives as two sysEvents (SDK 0.0.14+): press, release.
    if (sysType === OsEventTypeList.LONG_PRESS_EVENT) {
      void app.handle('longpress')
      return
    }
    if (sysType === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) {
      void app.handle('longpressRelease')
      return
    }
    if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
      void app.handle('tap')
      return
    }
    // Scroll gestures arrive through the text container.
    if (textType === OsEventTypeList.SCROLL_TOP_EVENT) void app.handle('swipeUp')
    if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) void app.handle('swipeDown')
  })

  await app.init()
}
