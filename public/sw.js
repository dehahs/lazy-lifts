if(!self.define){let e,s={};const a=(a,n)=>(a=new URL(a+".js",n).href,s[a]||new Promise((s=>{if("document"in self){const e=document.createElement("script");e.src=a,e.onload=s,document.head.appendChild(e)}else e=a,importScripts(a),s()})).then((()=>{let e=s[a];if(!e)throw new Error(`Module ${a} didn’t register its module`);return e})));self.define=(n,i)=>{const c=e||("document"in self?document.currentScript.src:"")||location.href;if(s[c])return;let t={};const r=e=>a(e,c),o={module:{uri:c},exports:t,require:r};s[c]=Promise.all(n.map((e=>o[e]||r(e)))).then((e=>(i(...e),t)))}}define(["./workbox-4754cb34"],(function(e){"use strict";importScripts(),self.skipWaiting(),e.clientsClaim(),e.precacheAndRoute([{url:"/_next/app-build-manifest.json",revision:"9d02c9586c54b93cf435705227b52869"},{url:"/_next/static/FbbHaE8OZ6PIwrHv6VR7V/_buildManifest.js",revision:"c155cce658e53418dec34664328b51ac"},{url:"/_next/static/FbbHaE8OZ6PIwrHv6VR7V/_ssgManifest.js",revision:"b6652df95db52feb4daf4eca35380933"},{url:"/_next/static/chunks/117-1d352350361de982.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/2e5b0c64-32d73085b23d5427.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/387-48675f7eb5e5bf4c.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/434-e3a713e70cf93c2f.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/697-e02a51f6ea2eda5d.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/app/_not-found/page-c8219ab21dbb5ed7.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/app/layout-8a6cb27aa2fa53b4.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/app/page-ddec97574e871668.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/app/profile/page-12fed6b1f79d3dce.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/bc9e92e6-db0a3eebe874eb29.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/fd9d1056-b88f8a4cc02eef8b.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/framework-f66176bb897dc684.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/main-822b8152db1c81ad.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/main-app-2fcca89b22e9bf61.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/pages/_app-72b849fbd24ac258.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/pages/_error-7ba65e1336b92748.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/chunks/polyfills-42372ed130431b0a.js",revision:"846118c33b2c0e922d7b3a7676f81f6f"},{url:"/_next/static/chunks/webpack-59963277a198d9ab.js",revision:"FbbHaE8OZ6PIwrHv6VR7V"},{url:"/_next/static/css/d31c2401041293d9.css",revision:"d31c2401041293d9"},{url:"/_next/static/media/26a46d62cd723877-s.woff2",revision:"befd9c0fdfa3d8a645d5f95717ed6420"},{url:"/_next/static/media/55c55f0601d81cf3-s.woff2",revision:"43828e14271c77b87e3ed582dbff9f74"},{url:"/_next/static/media/581909926a08bbc8-s.woff2",revision:"f0b86e7c24f455280b8df606b89af891"},{url:"/_next/static/media/6d93bde91c0c2823-s.woff2",revision:"621a07228c8ccbfd647918f1021b4868"},{url:"/_next/static/media/97e0cb1ae144a2a9-s.woff2",revision:"e360c61c5bd8d90639fd4503c829c2dc"},{url:"/_next/static/media/a34f9d1faa5f3315-s.p.woff2",revision:"d4fe31e6a2aebc06b8d6e558c9141119"},{url:"/_next/static/media/df0a9ae256c0569c-s.woff2",revision:"d54db44de5ccb18886ece2fda72bdfe0"},{url:"/icons/apple-icon-180.png",revision:"1046850efe1d5bf00d2bdaf5a3975d61"},{url:"/icons/favicon-196.png",revision:"f4ebb7624a14ed25b5b434ae4f70027e"},{url:"/icons/manifest-icon-192.maskable.png",revision:"c03cf3aa3b053adcf55cba8715c1e087"},{url:"/icons/manifest-icon-512.maskable.png",revision:"652756a40187bf7ff70767ce0da2d5e6"},{url:"/manifest.json",revision:"475de6783b2d49f020b3999f93e6e433"},{url:"/placeholder-icon.svg",revision:"28263703b3e6dccc5a6f5a682bbd39e8"},{url:"/placeholder-logo.png",revision:"b7d4c7dd55cf683c956391f9c2ce3f5b"},{url:"/placeholder-logo.svg",revision:"1e16dc7df824652c5906a2ab44aef78c"},{url:"/placeholder-user.jpg",revision:"82c9573f1276f9683ba7d92d8a8c6edd"},{url:"/placeholder.jpg",revision:"887632fd67dd19a0d58abde79d8e2640"},{url:"/placeholder.svg",revision:"35707bd9960ba5281c72af927b79291f"}],{ignoreURLParametersMatching:[]}),e.cleanupOutdatedCaches(),e.registerRoute("/",new e.NetworkFirst({cacheName:"start-url",plugins:[{cacheWillUpdate:async({request:e,response:s,event:a,state:n})=>s&&"opaqueredirect"===s.type?new Response(s.body,{status:200,statusText:"OK",headers:s.headers}):s}]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,new e.CacheFirst({cacheName:"google-fonts-webfonts",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:31536e3})]}),"GET"),e.registerRoute(/^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,new e.StaleWhileRevalidate({cacheName:"google-fonts-stylesheets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,new e.StaleWhileRevalidate({cacheName:"static-font-assets",plugins:[new e.ExpirationPlugin({maxEntries:4,maxAgeSeconds:604800})]}),"GET"),e.registerRoute(/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,new e.StaleWhileRevalidate({cacheName:"static-image-assets",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/image\?url=.+$/i,new e.StaleWhileRevalidate({cacheName:"next-image",plugins:[new e.ExpirationPlugin({maxEntries:64,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp3|wav|ogg)$/i,new e.CacheFirst({cacheName:"static-audio-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:mp4)$/i,new e.CacheFirst({cacheName:"static-video-assets",plugins:[new e.RangeRequestsPlugin,new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:js)$/i,new e.StaleWhileRevalidate({cacheName:"static-js-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:css|less)$/i,new e.StaleWhileRevalidate({cacheName:"static-style-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\/_next\/data\/.+\/.+\.json$/i,new e.StaleWhileRevalidate({cacheName:"next-data",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute(/\.(?:json|xml|csv)$/i,new e.NetworkFirst({cacheName:"static-data-assets",plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;const s=e.pathname;return!s.startsWith("/api/auth/")&&!!s.startsWith("/api/")}),new e.NetworkFirst({cacheName:"apis",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:16,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>{if(!(self.origin===e.origin))return!1;return!e.pathname.startsWith("/api/")}),new e.NetworkFirst({cacheName:"others",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:86400})]}),"GET"),e.registerRoute((({url:e})=>!(self.origin===e.origin)),new e.NetworkFirst({cacheName:"cross-origin",networkTimeoutSeconds:10,plugins:[new e.ExpirationPlugin({maxEntries:32,maxAgeSeconds:3600})]}),"GET")}));
