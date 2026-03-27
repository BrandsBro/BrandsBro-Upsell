export const loader = () => {
  const js = `
(function() {
  var appUrl = "https://brandsbro-upsell.onrender.com";
  console.log("BB: script loaded, Shopify:", window.Shopify && window.Shopify.shop);
  var shopDomain = (window.Shopify && window.Shopify.shop) || new URLSearchParams(window.location.search).get("shop") || document.querySelector("link[rel=canonical]") && new URL(document.querySelector("link[rel=canonical]").href).hostname;
  if (!shopDomain) return;

  var upsellProducts = [];

  function loadUpsellProducts(callback) {
    fetch(appUrl + "/api/cart-upsell?shop=" + shopDomain)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        upsellProducts = data.products || [];
        callback(upsellProducts);
      })
      .catch(function() { callback([]); });
  }

  function buildWidget(products) {
    var widget = document.createElement("div");
    widget.id = "bb-cart-upsell-widget";
    widget.style.cssText = "padding:16px;border-top:1px solid #e5e5e5;";
    widget.innerHTML = '<p style="font-size:13px;font-weight:700;margin:0 0 12px;color:#333;">You might also like</p>' +
      '<div style="display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;padding-bottom:4px;">' +
      products.map(function(p) {
        var vid = p.variantId.split("/").pop();
        return '<div style="flex-shrink:0;width:130px;background:#fff;border:1px solid #e5e5e5;border-radius:8px;overflow:hidden;">' +
          (p.image ? '<img src="' + p.image + '" style="width:100%;height:90px;object-fit:cover;"/>' : '') +
          '<div style="padding:8px;">' +
          '<p style="font-size:11px;font-weight:600;margin:0 0 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.title + '</p>' +
          '<p style="font-size:11px;color:#666;margin:0 0 6px;">$' + p.price + '</p>' +
          '<button id="bb-btn-' + vid + '" onclick="bbUpsellAdd(\'' + vid + '\')" style="width:100%;background:#000;color:#fff;border:none;border-radius:4px;padding:5px;font-size:11px;font-weight:600;cursor:pointer;">+ Add</button>' +
          '</div></div>';
      }).join('') + '</div>';
    return widget;
  }

  function injectWidget() {
    if (!upsellProducts.length) return;
    var existing = document.getElementById("bb-cart-upsell-widget");
    if (existing) existing.remove();
    var cartDrawer = document.querySelector("cart-drawer");
    if (!cartDrawer) return;
    var footer = cartDrawer.querySelector(".drawer__footer");
    if (footer) {
      footer.insertBefore(buildWidget(upsellProducts), footer.firstChild);
    }
  }

  // Patch renderContents to re-inject after it runs
  function patchRenderContents() {
    var cartDrawer = document.querySelector("cart-drawer");
    if (!cartDrawer || cartDrawer.__bbPatched) return;
    cartDrawer.__bbPatched = true;
    var orig = cartDrawer.renderContents.bind(cartDrawer);
    cartDrawer.renderContents = function(state) {
      orig(state);
      setTimeout(injectWidget, 50);
    };
  }

  window.bbUpsellAdd = function(variantId) {
    var btn = document.getElementById("bb-btn-" + variantId);
    if (btn) { btn.disabled = true; btn.textContent = "Adding..."; }
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: 1 }] })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      if (btn) { btn.textContent = "✓ Added"; btn.style.background = "#008060"; }
      setTimeout(function() {
        fetch("/?sections=cart-drawer,cart-icon-bubble")
          .then(function(r) { return r.json(); })
          .then(function(sections) {
            var cartDrawer = document.querySelector("cart-drawer");
            if (cartDrawer && typeof cartDrawer.renderContents === "function") {
              cartDrawer.classList.remove("is-empty");
              cartDrawer.renderContents({ sections: sections });
            }
            var doc = new DOMParser().parseFromString(sections["cart-icon-bubble"] || "", "text/html");
            var newBubble = doc.querySelector(".cart-count-bubble");
            var oldBubble = document.querySelector(".cart-count-bubble");
            if (oldBubble && newBubble) oldBubble.outerHTML = newBubble.outerHTML;
          });
      }, 800);
      setTimeout(function() {
        if (btn) { btn.textContent = "+ Add"; btn.style.background = "#000"; btn.disabled = false; }
      }, 2000);
    });
  };

  function init() {
    console.log("BB Upsell: init called");
    console.log("BB Upsell: cart drawer found:", !!document.querySelector("cart-drawer"));
    loadUpsellProducts(function(products) {
      console.log("BB Upsell: products loaded:", products.length);
      if (!products.length) return;
      patchRenderContents();
      var cartDrawer = document.querySelector("cart-drawer");
      if (cartDrawer) {
        new MutationObserver(function() {
          if (cartDrawer.classList.contains("active")) {
            patchRenderContents();
            injectWidget();
          }
        }).observe(cartDrawer, { attributes: true, attributeFilter: ["class"] });
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
