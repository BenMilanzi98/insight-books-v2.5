package com.insightbooksafrica.insightbooks_android

import android.content.Context
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintJob
import android.print.PrintManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private val channelName =
        "com.insightbooksafrica.insightbooks_android/thermal_receipt_print"

    /** Hidden WebView used only to render the same HTML receipt as web `/pos`. */
    private var printWebView: WebView? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                if (call.method != "printThermalReceipt") {
                    result.notImplemented()
                    return@MethodChannel
                }
                val url = call.argument<String>("url") ?: ""
                if (url.isEmpty()) {
                    result.error("BAD_ARGUMENTS", "url is required", null)
                    return@MethodChannel
                }
                val authorization = call.argument<String>("authorization")
                val cookie = call.argument<String>("cookie")
                runOnUiThread {
                    startThermalReceiptPrint(url, authorization, cookie, result)
                }
            }
    }

    private fun startThermalReceiptPrint(
        url: String,
        authorization: String?,
        cookie: String?,
        result: MethodChannel.Result,
    ) {
        printWebView?.let { old ->
            try {
                old.stopLoading()
                old.destroy()
            } catch (_: Exception) {
            }
        }
        printWebView = null

        val wv = WebView(this)
        printWebView = wv
        wv.setBackgroundColor(Color.WHITE)
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.settings.loadWithOverviewMode = true
        wv.settings.useWideViewPort = true

        val headers = mutableMapOf<String, String>()
        if (!authorization.isNullOrEmpty()) {
            headers["Authorization"] = authorization
        }
        if (!cookie.isNullOrEmpty()) {
            headers["Cookie"] = cookie
        }

        val handler = Handler(Looper.getMainLooper())
        var debounced: Runnable? = null
        var started = false
        var resultSent = false

        fun sendError(code: String, message: String?) {
            if (resultSent) return
            resultSent = true
            result.error(code, message, null)
        }

        fun sendSuccess() {
            if (resultSent) return
            resultSent = true
            result.success(true)
        }

        wv.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                if (request.isForMainFrame) {
                    debounced?.let { handler.removeCallbacks(it) }
                    sendError(
                        "LOAD_FAILED",
                        error.description?.toString() ?: "WebView error",
                    )
                    cleanupWebViewDelayed(wv, delayMs = 500L)
                }
            }

            @Deprecated("Deprecated in Java")
            override fun onReceivedError(
                view: WebView,
                errorCode: Int,
                description: String?,
                failingUrl: String?,
            ) {
                if (resultSent) return
                debounced?.let { handler.removeCallbacks(it) }
                sendError("LOAD_FAILED", description ?: "WebView error")
                cleanupWebViewDelayed(wv, delayMs = 500L)
            }

            override fun onPageFinished(view: WebView, finishedUrl: String?) {
                debounced?.let { handler.removeCallbacks(it) }
                debounced = Runnable {
                    if (started || resultSent) return@Runnable
                    started = true
                    try {
                        val printMgr =
                            getSystemService(Context.PRINT_SERVICE) as PrintManager
                        val jobName = "Receipt"
                        @Suppress("DEPRECATION")
                        val adapter: PrintDocumentAdapter =
                            view.createPrintDocumentAdapter(jobName)
                        val widthMils = (80.0 / 25.4 * 1000.0).toInt()
                        val heightMils = 11 * 1000
                        val mediaSize = PrintAttributes.MediaSize(
                            "ROLL_80MM",
                            "80mm thermal",
                            widthMils,
                            heightMils,
                        )
                        val attrs = PrintAttributes.Builder()
                            .setMediaSize(mediaSize)
                            .setResolution(
                                PrintAttributes.Resolution(
                                    "thermal",
                                    "thermal",
                                    203,
                                    203,
                                ),
                            )
                            .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                            .build()
                        val printJob: PrintJob =
                            printMgr.print(jobName, adapter, attrs)
                        sendSuccess()
                        scheduleWebViewCleanupAfterPrint(printJob, view, handler)
                    } catch (e: Exception) {
                        sendError("PRINT_FAILED", e.message)
                        cleanupWebViewDelayed(view, delayMs = 500L)
                    }
                }
                handler.postDelayed(debounced!!, 500L)
            }
        }

        wv.loadUrl(url, headers)
    }

    private fun scheduleWebViewCleanupAfterPrint(
        printJob: PrintJob,
        wv: WebView,
        handler: Handler,
    ) {
        val poll = object : Runnable {
            override fun run() {
                when {
                    printJob.isCompleted || printJob.isFailed || printJob.isCancelled -> {
                        cleanupWebViewDelayed(wv, delayMs = 300L)
                    }

                    else -> handler.postDelayed(this, 400L)
                }
            }
        }
        handler.postDelayed(poll, 600L)
    }

    private fun cleanupWebViewDelayed(wv: WebView, delayMs: Long) {
        Handler(Looper.getMainLooper()).postDelayed({
            try {
                if (printWebView === wv) {
                    printWebView = null
                }
                wv.stopLoading()
                wv.destroy()
            } catch (_: Exception) {
            }
        }, delayMs)
    }
}
