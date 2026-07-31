{ lib, stdenv, fetchurl
, dpkg, autoPatchelfHook, makeWrapper, wrapGAppsHook3
, gtk3, gdk-pixbuf, cairo, glib, webkitgtk_4_1, libsoup_3, libgcc, gst_all_1
}:

let
  sources = builtins.fromJSON (builtins.readFile ./sources.json);
  version = sources.version;

  srcMap = {
    x86_64-linux = fetchurl {
      url = "https://github.com/codewiththiha/OpenSlides/releases/download/v${version}/OpenSlides_${version}_amd64.deb";
      hash = sources.hashes.x86_64-linux;
    };
    x86_64-darwin = fetchurl {
      url = "https://github.com/codewiththiha/OpenSlides/releases/download/v${version}/OpenSlides_x64.app.tar.gz";
      hash = sources.hashes.x86_64-darwin;
    };
    aarch64-darwin = fetchurl {
      url = "https://github.com/codewiththiha/OpenSlides/releases/download/v${version}/OpenSlides_aarch64.app.tar.gz";
      hash = sources.hashes.aarch64-darwin;
    };
  };

  sys = stdenv.hostPlatform.system;

in

assert lib.assertMsg (builtins.hasAttr sys srcMap)
  "openslides: unsupported platform ${sys}";

stdenv.mkDerivation {
  pname = "openslides";
  inherit version;

  src = srcMap.${sys};

  nativeBuildInputs = lib.optionals stdenv.hostPlatform.isLinux [
    dpkg autoPatchelfHook makeWrapper wrapGAppsHook3
  ];

  buildInputs = lib.optionals stdenv.hostPlatform.isLinux [
    gtk3 gdk-pixbuf cairo glib webkitgtk_4_1 libsoup_3 libgcc
    gst_all_1.gstreamer gst_all_1.gst-plugins-base
    gst_all_1.gst-plugins-good gst_all_1.gst-plugins-bad
  ];

  GST_PLUGIN_SYSTEM_PATH = lib.optionalString stdenv.hostPlatform.isLinux
    "${gst_all_1.gst-plugins-base}/lib/gstreamer-1.0:${gst_all_1.gst-plugins-good}/lib/gstreamer-1.0:${gst_all_1.gst-plugins-bad}/lib/gstreamer-1.0";

  # wrapGAppsHook3 would auto-wrap the binary in postFixup; we wrap it manually
  # to add the GStreamer path, so disable the auto-wrap and splice the hook's
  # GApps args into our single wrapper instead of nesting two wrappers.
  dontWrapGApps = true;

  unpackPhase = if stdenv.hostPlatform.isLinux then "dpkg -x $src ." else "tar xzf $src";

  installPhase = if stdenv.hostPlatform.isLinux then ''
    mkdir -p $out/bin $out/share
    cp -r usr/share/* $out/share/
    install -Dm755 usr/bin/openslides $out/bin/openslides

    wrapProgram $out/bin/openslides \
      "''${gappsWrapperArgs[@]}" \
      --prefix GST_PLUGIN_SYSTEM_PATH : "$GST_PLUGIN_SYSTEM_PATH"
  '' else ''
    mkdir -p $out/Applications
    cp -r *.app $out/Applications/
  '';

  meta = with lib; {
    description = "Offline-first code presentation desktop app";
    homepage = "https://github.com/codewiththiha/OpenSlides";
    license = licenses.mit;
    platforms = [ "x86_64-linux" "x86_64-darwin" "aarch64-darwin" ];
    mainProgram = "openslides";
  };
}
