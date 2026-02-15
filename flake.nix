{
  description = "mctx-ai/mcp-server development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              pnpm
            ];

            shellHook = ''
              echo "mcp-server dev environment"
              echo "Node: $(node --version)"
              echo "pnpm: $(pnpm --version)"
            '';
          };
        });
    };
}
