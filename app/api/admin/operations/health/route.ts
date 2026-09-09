import {getSessionUser} from '@/server/auth';
import {isAdminUser} from '@/server/admin';
import {operationalSignals} from '@/server/operational-signals';
export const dynamic='force-dynamic';
export async function GET(request:Request){const user=await getSessionUser(request);if(!user)return new Response(null,{status:401});if(!isAdminUser(user.email,user.phone))return new Response(null,{status:403});return Response.json(await operationalSignals(),{headers:{'cache-control':'no-store'}});}
