{
  description = "OpenSlides — offline-first code presentation desktop app";

  inputs.nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

  outputs = { self, nixpkgs }: let
    forAllSystems = nixpkgs.lib.genAttrs [ "x86_64-linux" "x86_64-darwin" "aarch64-darwin" ];
  in {
    packages = forAllSystems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      openslides = pkgs.callPackage ./nix/package.nix { };
      default = self.packages.${system}.openslides;
    });

    nixosModules.openslides = { pkgs, ... }: {
      environment.systemPackages = [ self.packages.${pkgs.system}.openslides ];
    };

    darwinModules.openslides = { pkgs, ... }: {
      environment.systemPackages = [ self.packages.${pkgs.system}.openslides ];
    };
  };
}
