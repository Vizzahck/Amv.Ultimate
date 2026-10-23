(function(){
  var dark=false;
  try {
    var consent=localStorage.getItem("amv-cookie-choice");
    // Só usar a preferência opcional se a pessoa autorizou.
    var saved=consent==="accepted" ? localStorage.getItem("amv-theme") : null;
    dark=saved==="dark" || (saved!=="light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch(e) {
    dark=window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  document.documentElement.classList.toggle("dark",dark);
})();