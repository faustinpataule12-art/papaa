package com.nps.papaa;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.*;
import android.widget.Toast;
public class MainActivity extends Activity {
    private WebView webView;
    @SuppressLint({"SetJavaScriptEnabled"})
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true); s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setUseWideViewPort(true); s.setCacheMode(WebSettings.LOAD_DEFAULT);
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                String url = r.getUrl().toString();
                if (url.startsWith("file://")) return false;
                if (isDownloadUrl(url)) return false;
                try { Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url)); i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); startActivity(i); } catch (Exception e) {}
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        webView.setDownloadListener(new DownloadListener() {
            @Override public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                    DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
                    req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                    req.setMimeType(mimeType != null ? mimeType : "application/vnd.android.package-archive");
                    DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    dm.enqueue(req);
                    Toast.makeText(MainActivity.this, "Telechargement en arriere-plan: " + fileName, Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Erreur telechargement: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
        });
        webView.loadUrl("file:///android_asset/www/index.html");
    }
    private boolean isDownloadUrl(String url) {
        return url.endsWith(".apk")
            || url.contains("objects.githubusercontent.com")
            || url.contains("release-assets.githubusercontent.com")
            || url.contains("/releases/download/");
    }
    @Override public void onBackPressed() {
        if (webView.canGoBack()) { webView.goBack(); return; }
        new android.app.AlertDialog.Builder(this)
            .setMessage("Voulez-vous quitter l'application ?")
            .setPositiveButton("Oui", (d, w) -> MainActivity.super.onBackPressed())
            .setNegativeButton("Non", null)
            .show();
    }
}
