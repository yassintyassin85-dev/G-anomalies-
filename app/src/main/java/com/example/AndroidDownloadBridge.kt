package com.example

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

/**
 * Passerelle JavaScript - Android pour l'exportation et le partage des fichiers
 * Excel (.xlsx) et des sauvegardes JSON.
 */
class AndroidDownloadBridge(private val activity: Activity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun saveAndShareFile(filename: String, mimeType: String, base64Data: String) {
        try {
            val bytes = Base64.decode(base64Data, Base64.DEFAULT)
            val exportDir = File(activity.cacheDir, "exports")
            if (!exportDir.exists()) {
                exportDir.mkdirs()
            }

            val targetFile = File(exportDir, filename)
            FileOutputStream(targetFile).use { fos ->
                fos.write(bytes)
                fos.flush()
            }

            val authority = "${activity.packageName}.fileprovider"
            val fileUri: Uri = FileProvider.getUriForFile(activity, authority, targetFile)

            mainHandler.post {
                try {
                    Toast.makeText(
                        activity,
                        "Fichier prêt : $filename",
                        Toast.LENGTH_SHORT
                    ).show()

                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = mimeType.ifEmpty { "*/*" }
                        putExtra(Intent.EXTRA_STREAM, fileUri)
                        putExtra(Intent.EXTRA_SUBJECT, filename)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }

                    val chooser = Intent.createChooser(sendIntent, "Partager le fichier ($filename)")
                    activity.startActivity(chooser)
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(
                        activity,
                        "Fichier enregistré dans le cache : $filename",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            mainHandler.post {
                Toast.makeText(
                    activity,
                    "Erreur d'exportation : ${e.localizedMessage}",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
