package com.chatapp.dev;

import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private boolean volumeUpPressed = false;
    private boolean volumeDownPressed = false;
    private long lastVolumeUpTime = 0;
    private long lastVolumeDownTime = 0;
    private static final long SIMULTANEOUS_WINDOW = 300;

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        long now = System.currentTimeMillis();

        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            volumeUpPressed = true;
            lastVolumeUpTime = now;
            if (volumeDownPressed && (now - lastVolumeDownTime) < SIMULTANEOUS_WINDOW) {
                fireBothPressedEvent();
                return true;
            }
        } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            volumeDownPressed = true;
            lastVolumeDownTime = now;
            if (volumeUpPressed && (now - lastVolumeUpTime) < SIMULTANEOUS_WINDOW) {
                fireBothPressedEvent();
                return true;
            }
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
            volumeUpPressed = false;
        } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            volumeDownPressed = false;
        }
        return super.onKeyUp(keyCode, event);
    }

    private void fireBothPressedEvent() {
        if (this.bridge != null) {
            this.bridge.triggerJSEvent("volumeBothPressed", "window");
        }
    }
}
