package com.example

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.JsResult
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.viewinterop.AndroidView
import com.example.ui.theme.MyApplicationTheme

class MainActivity : ComponentActivity() {

    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private var activeWebView: WebView? = null

    private val filePickerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val intent = result.data
            val uris: Array<Uri>? = when {
                intent?.data != null -> arrayOf(intent.data!!)
                intent?.clipData != null -> {
                    val clip = intent.clipData!!
                    Array(clip.itemCount) { i -> clip.getItemAt(i).uri }
                }
                else -> null
            }
            fileChooserCallback?.onReceiveValue(uris)
        } else {
            fileChooserCallback?.onReceiveValue(null)
        }
        fileChooserCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            MyApplicationTheme {
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .windowInsetsPadding(WindowInsets.safeDrawing),
                    color = MaterialTheme.colorScheme.background
                ) {
                    WaterMetersAppView(
                        activity = this,
                        onWebViewReady = { webView -> activeWebView = webView }
                    )
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Composable
    fun WaterMetersAppView(
        activity: MainActivity,
        onWebViewReady: (WebView) -> Unit
    ) {
        var webViewRef by remember { mutableStateOf<WebView?>(null) }

        BackHandler(enabled = true) {
            webViewRef?.let { wv ->
                wv.evaluateJavascript(
                    """
                    (function() {
                        var form = document.getElementById('view-form');
                        if (form && !form.classList.contains('hidden')) {
                            var cancelBtn = document.getElementById('btn-cancel-meter');
                            if (cancelBtn) { cancelBtn.click(); return 'HANDLED'; }
                        }
                        var modal = document.getElementById('confirm-modal');
                        if (modal && !modal.classList.contains('hidden')) {
                            var modalCancel = document.getElementById('btn-modal-cancel');
                            if (modalCancel) { modalCancel.click(); return 'HANDLED'; }
                        }
                        return 'NOT_HANDLED';
                    })();
                    """.trimIndent()
                ) { result ->
                    val cleanResult = result?.replace("\"", "") ?: ""
                    if (cleanResult != "HANDLED") {
                        if (wv.canGoBack()) {
                            wv.goBack()
                        } else {
                            activity.finish()
                        }
                    }
                }
            } ?: activity.finish()
        }

        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .testTag("water_meters_webview"),
            factory = { context ->
                WebView(context).apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        useWideViewPort = true
                        loadWithOverviewMode = true
                        cacheMode = WebSettings.LOAD_DEFAULT
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    }

                    // Passerelle d'exportation vers Android
                    addJavascriptInterface(AndroidDownloadBridge(activity), "AndroidBridge")

                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): Boolean {
                            return false
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallback: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?
                        ): Boolean {
                            fileChooserCallback?.onReceiveValue(null)
                            fileChooserCallback = filePathCallback

                            val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                                addCategory(Intent.CATEGORY_OPENABLE)
                                type = "application/json"
                                putExtra(
                                    Intent.EXTRA_MIME_TYPES,
                                    arrayOf("application/json", "text/*", "*/*")
                                )
                            }
                            activity.filePickerLauncher.launch(
                                Intent.createChooser(intent, "Sélectionner la sauvegarde JSON")
                            )
                            return true
                        }

                        override fun onJsAlert(
                            view: WebView?,
                            url: String?,
                            message: String?,
                            result: JsResult?
                        ): Boolean {
                            return super.onJsAlert(view, url, message, result)
                        }

                        override fun onJsConfirm(
                            view: WebView?,
                            url: String?,
                            message: String?,
                            result: JsResult?
                        ): Boolean {
                            return super.onJsConfirm(view, url, message, result)
                        }

                        override fun onConsoleMessage(consoleMessage: ConsoleMessage?): Boolean {
                            return super.onConsoleMessage(consoleMessage)
                        }
                    }

                    // Chargement de l'application web locale
                    loadUrl("file:///android_asset/index.html")

                    webViewRef = this
                    onWebViewReady(this)
                }
            },
            update = { webView ->
                webViewRef = webView
                onWebViewReady(webView)
            }
        )
    }

    override fun onDestroy() {
        activeWebView?.destroy()
        activeWebView = null
        super.onDestroy()
    }
}
