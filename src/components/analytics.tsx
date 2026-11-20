import Script from "next/script";

/**
 * Google Analytics 4, Google Tag Manager and Microsoft Clarity. Loaded only in production builds, so local
 * testing doesn't show up in the reports. The ids are public (they're in every page's HTML anyway); set the
 * env var to "" to switch one off. Origins are allowed in the CSP in next.config.ts.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-MG3JMYCV8M";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-5999MZPL";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "z9b4gemj5m";
/** Meta Pixel (browser PageView + the _fbp cookie). Conversions are sent from the server: src/lib/meta/capi.ts. */
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? process.env.META_PIXEL_ID ?? "4537219149865300";

const SAFE_ID = /^[A-Za-z0-9-]+$/;

export function Analytics() {
  if (process.env.NODE_ENV !== "production") return null;
  const ga = SAFE_ID.test(GA_ID) ? GA_ID : "";
  const gtm = SAFE_ID.test(GTM_ID) ? GTM_ID : "";
  const clarity = SAFE_ID.test(CLARITY_ID) ? CLARITY_ID : "";
  const metaPixel = /^\d{5,20}$/.test(META_PIXEL_ID.trim()) ? META_PIXEL_ID.trim() : "";

  return (
    <>
      {(ga || gtm) && (
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());` +
            (ga ? `gtag('config','${ga}');` : "") +
            (gtm ? `dataLayer.push({'gtm.start':new Date().getTime(),event:'gtm.js'});` : "")}
        </Script>
      )}
      {ga && <Script id="gtag-js" src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />}
      {gtm && <Script id="gtm-js" src={`https://www.googletagmanager.com/gtm.js?id=${gtm}`} strategy="afterInteractive" />}
      {clarity && (
        // The id must NOT be "clarity": browsers expose elements with an id as window globals, so <script id="clarity">
        // would become window.clarity and Clarity's tag would crash with "a[c] is not a function".
        <Script id="ms-clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");`}
        </Script>
      )}
      {metaPixel && (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
        </Script>
      )}
      {metaPixel && (
        // Visitors without JavaScript still count as a page view.
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${metaPixel}&ev=PageView&noscript=1`} />
        </noscript>
      )}
    </>
  );
}
