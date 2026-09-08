import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        GameWebView()
            .ignoresSafeArea()
            .statusBar(hidden: true)
    }
}

struct GameWebView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        // Lets the game read/write localStorage (used for the best-score save).
        config.websiteDataStore = .default()
        config.preferences.javaScriptEnabled = true

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        // "www" must be added to the Xcode project as a folder reference
        // (blue folder icon), not a group, so index.html can find
        // style.css / game.js next to it at runtime.
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            // Fallback in case the folder wasn't added as a reference —
            // shows a clear error instead of a blank screen.
            webView.loadHTMLString(
                "<body style='background:#05050a;color:#e8f6ff;font-family:sans-serif;padding:24px'>" +
                "Couldn't find www/index.html in the app bundle.<br><br>" +
                "Make sure the 'www' folder was added to Xcode as a " +
                "<b>folder reference</b> (blue icon), not a group.</body>",
                baseURL: nil
            )
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
