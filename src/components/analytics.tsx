import Script from "next/script";

/**
 * Google Analytics 4, Google Tag Manager and Microsoft Clarity. Loaded only in production builds, so local
 * testing doesn't show up in the reports. The ids are public (they're in every page's HTML anyway); set the
 * env var to "" to switch one off. Origins are allowed in the CSP in next.config.ts.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "G-MG3JMYCV8M";
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-5999MZPL";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "z9b4gemj5m";

const SAFE_ID = /^[A-Za-z0-9-]+$/;

export function Analytics() {
  if (process.env.NODE_ENV !== "production") return null;
  const ga = SAFE_ID.test(GA_ID) ? GA_ID : "";
  const gtm = SAFE_ID.test(GTM_ID) ? GTM_ID : "";
  const clarity = SAFE_ID.test(CLARITY_ID) ? CLARITY_ID : "";

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
        <Script id="clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarity}");`}
        </Script>
      )}
    </>
  );
}
