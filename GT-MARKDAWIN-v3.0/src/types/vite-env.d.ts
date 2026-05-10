/// <reference types="vite/client" />

// Allow importing CSS files as raw strings via ?inline query
declare module '*?inline' {
  const content: string;
  export default content;
}

declare module '*?raw' {
  const content: string;
  export default content;
}
