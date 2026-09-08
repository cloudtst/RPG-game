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
        config.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        if let url = locateIndexHTML() {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            webView.loadHTMLString(diagnosticHTML(), baseURL: nil)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private func locateIndexHTML() -> URL? {
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            return url
        }
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            return url
        }
        if let resourcePath = Bundle.main.resourcePath {
            let candidates = [
                resourcePath + "/www/index.html",
                resourcePath + "/NeonRunner/www/index.html",
            ]
            for path in candidates {
                if FileManager.default.fileExists(atPath: path) {
                    return URL(fileURLWithPath: path)
                }
            }
        }
        return nil
    }

    private func diagnosticHTML() -> String {
        var listing = "(couldn't read bundle contents)"
        if let resourcePath = Bundle.main.resourcePath,
           let items = try? FileManager.default.contentsOfDirectory(atPath: resourcePath) {
            listing = items.sorted().joined(separator: "<br>")
        }
        return """
        <body style='background:#05050a;color:#e8f6ff;font-family:sans-serif;
        padding:24px;font-size:14px;line-height:1.5'>
        <b>Couldn't find index.html in the app bundle.</b><br><br>
        Top-level bundle contents:<br>
        <div style='color:#7CF9FF;margin-top:8px'>\(listing)</div>
        <br>Send this list back and it'll show exactly where the www
        files ended up.
        </body>
        """
    }
}
