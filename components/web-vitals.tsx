"use client";
import {useEffect} from 'react';
import {performanceRoute} from '@/core/performance';
export function WebVitals(){
 useEffect(()=>{
  if(navigator.doNotTrack==='1'||Math.random()>=0.1)return;
  let active=true;
  const route=performanceRoute(location.pathname); // original navigation, no query/slug/account identifiers
  void import('web-vitals').then(({onLCP,onINP,onCLS})=>{
   const report=(metric:{name:string;value:number})=>{
    if(!active||!Number.isFinite(metric.value))return;
    navigator.sendBeacon('/api/telemetry/vitals',new Blob([JSON.stringify({name:metric.name,value:Math.round(metric.value*1000)/1000,route,device:window.innerWidth<768?'mobile':'desktop'})],{type:'application/json'}));
   };
   onLCP(report);onINP(report);onCLS(report);
  });
  return ()=>{active=false;};
 },[]);
 return null;
}
