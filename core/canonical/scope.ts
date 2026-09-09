import type { AnalysisChannelId, SalesChannelId } from "../channels/catalog";

export type ChannelScoped = {
  channelId?: SalesChannelId;
  channelAccountId?: string;
};

export function effectiveChannelId(value: ChannelScoped): AnalysisChannelId {
  return value.channelId ?? "unknown";
}

export function channelScopeKey(value: ChannelScoped): string {
  return `${effectiveChannelId(value)}::${value.channelAccountId?.trim() || "default"}`;
}

export function scopedOrderKey(value: ChannelScoped & { subOrderId: string }): string {
  return `${channelScopeKey(value)}::order::${value.subOrderId.trim()}`;
}

export function scopedSkuKey(value: ChannelScoped & { sku: string }): string {
  return `${channelScopeKey(value)}::sku::${value.sku.trim()}`;
}
