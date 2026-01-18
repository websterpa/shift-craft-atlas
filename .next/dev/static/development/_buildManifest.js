self.__BUILD_MANIFEST = {
  "/": [
    "static/chunks/pages/index.js"
  ],
  "/docs": [
    "static/chunks/pages/docs.js"
  ],
  "__rewrites": {
    "afterFiles": [
      {
        "source": "/api/:path*"
      },
      {
        "source": "/app/:path*",
        "destination": "/app/index.html"
      }
    ],
    "beforeFiles": [],
    "fallback": []
  },
  "sortedPages": [
    "/",
    "/_app",
    "/_error",
    "/case-studies",
    "/cookies",
    "/docs",
    "/features",
    "/industries",
    "/industries/[slug]",
    "/pricing",
    "/privacy"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()