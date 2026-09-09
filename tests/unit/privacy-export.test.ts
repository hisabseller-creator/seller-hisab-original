import {it,expect} from 'vitest';
import {portableData} from '@/core/privacy-export';
it('excludes secrets from nested portability and audit JSON',()=>{const out=portableData({amountPaise:4900,providerPaymentId:'pay_reference',passwordHash:'secret',nested:{consumerSecret:'secret',access_token:'secret',sku:'SKU1'},metadataJson:JSON.stringify({refreshToken:'secret',count:2})});expect(JSON.stringify(out)).not.toContain('secret');expect(out).toMatchObject({amountPaise:4900,providerPaymentId:'pay_reference',nested:{sku:'SKU1'},metadataJson:'{"count":2}'});});
