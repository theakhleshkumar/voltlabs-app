package com.voltlabsapp;

import android.app.Activity;
import android.bluetooth.BluetoothAdapter;
import android.content.Intent;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class BluetoothModule extends ReactContextBaseJavaModule {
    private static final int REQUEST_ENABLE_BT = 1001;
    private Promise mEnablePromise;

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode == REQUEST_ENABLE_BT) {
                if (mEnablePromise != null) {
                    if (resultCode == Activity.RESULT_OK) {
                        mEnablePromise.resolve(true);
                    } else {
                        mEnablePromise.resolve(false);
                    }
                    mEnablePromise = null;
                }
            }
        }
    };

    BluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(mActivityEventListener);
    }

    @NonNull
    @Override
    public String getName() {
        return "BluetoothModule";
    }

    @ReactMethod
    public void requestEnable(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available");
            return;
        }

        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            promise.reject("NOT_SUPPORTED", "Bluetooth is not supported on this device");
            return;
        }

        if (bluetoothAdapter.isEnabled()) {
            promise.resolve(true);
            return;
        }

        mEnablePromise = promise;
        Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
        activity.startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT);
    }

    @ReactMethod
    public void isEnabled(Promise promise) {
        BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
        if (bluetoothAdapter == null) {
            promise.resolve(false);
            return;
        }
        promise.resolve(bluetoothAdapter.isEnabled());
    }
}
