declare module 'uri-templates' {
  interface URITemplate {
    fill(vars: object): string;
    fillFromObject(vars: object): string;
    fromUri(uri: string): object | null;
    parse(template: string): URITemplate;
    process(vars: object): {uri: string, parts: Array<string | object>};
    stringify(vars: object): string;
    expand(vars: object): string; // expand is often used synonymously with fill
  }

  function parse(templateString: string): URITemplate;
  export default parse;
} 