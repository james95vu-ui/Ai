package com.vozrozhdenie.chr;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.view.HapticFeedbackConstants;
import android.graphics.Color;
import android.util.Base64;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

public class MainActivity extends Activity {
    private static final String GAME_URL = "file:///android_asset/index.html";
    private WebView webView;
    private String pendingAuthResult;
    private boolean pageReady;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(12, 25, 24));
        getWindow().setNavigationBarColor(Color.rgb(12, 25, 24));
        getWindow().getDecorView().setSystemUiVisibility(0);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(12, 25, 24));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                pageReady = GAME_URL.equals(url);
                deliverAuthResult();
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !GAME_URL.equals(url);
            }
        });
        webView.addJavascriptInterface(new CityHaptics(), "CityHaptics");
        webView.addJavascriptInterface(new CityAuth(), "CityAuth");
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
        readAuthIntent(getIntent());
        webView.loadUrl(GAME_URL);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        readAuthIntent(intent);
        deliverAuthResult();
    }

    private void readAuthIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return;
        Uri uri = intent.getData();
        if (uri == null || !uri.isHierarchical()
                || !"com.vozrozhdenie.chr".equals(uri.getScheme())
                || !"auth".equals(uri.getEncodedAuthority())
                || !"/callback".equals(uri.getEncodedPath())) return;

        String code = uri.getQueryParameter("code");
        if (uri.getQueryParameters("code").size() == 1
                && code != null && code.matches("[A-Za-z0-9_-]{16,256}")) {
            pendingAuthResult = JSONObject.quote(code);
        } else {
            pendingAuthResult = "null";
        }
        intent.setData(null);
    }

    private void deliverAuthResult() {
        if (!pageReady || pendingAuthResult == null || webView == null
                || !GAME_URL.equals(webView.getUrl())) return;
        webView.evaluateJavascript(
                "window.dispatchEvent(new CustomEvent('city-auth-return',{detail:"
                        + pendingAuthResult + "}));", null);
        pendingAuthResult = null;
    }

    private static String base64Url(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.NO_WRAP | Base64.NO_PADDING | Base64.URL_SAFE);
    }

    public static final class CityAuth {
        @JavascriptInterface
        public String createChallenge() {
            byte[] random = new byte[32];
            new SecureRandom().nextBytes(random);
            String verifier = base64Url(random);
            try {
                byte[] digest = MessageDigest.getInstance("SHA-256")
                        .digest(verifier.getBytes(StandardCharsets.US_ASCII));
                return verifier + "." + base64Url(digest);
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException("SHA-256 unavailable", e);
            }
        }
    }

    private final class CityHaptics {
        @JavascriptInterface
        public void tap() {
            runOnUiThread(() -> {
                if (webView != null && GAME_URL.equals(webView.getUrl())) {
                    webView.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
