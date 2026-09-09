type BuildProvenance={version:string;commit:string|null;sourceHash:string;builtAt:string|null};
declare const __SELLERHISAB_BUILD__:BuildProvenance;
export const releaseBuild:BuildProvenance=typeof __SELLERHISAB_BUILD__==='undefined'?{version:'unbuilt',commit:null,sourceHash:'unbuilt',builtAt:null}:__SELLERHISAB_BUILD__;
