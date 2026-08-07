// pdfmake ships its browser bundle and font pack as UMD files with no types.
// The composer in reportPdf.ts narrows them to the handful of members it uses.
declare module 'pdfmake/build/pdfmake.min.js' {
  const pdfMake: {
    createPdf: (def: unknown) => { download: (filename: string) => void };
    addVirtualFileSystem?: (vfs: unknown) => void;
    vfs?: unknown;
    setFonts: (fonts: unknown) => void;
  };
  export default pdfMake;
}
declare module 'pdfmake/build/vfs_fonts.js' {
  const vfs: Record<string, string>;
  export default vfs;
}
