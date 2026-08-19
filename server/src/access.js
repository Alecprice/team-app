import {fromNodeHeaders} from 'better-auth/node';
import {auth} from './auth.js';
import {query} from './db.js';

export const COACH_ROLES=['owner','admin','coach','assistant_coach','manager'];
export const ADMIN_ROLES=['owner','admin','coach'];

export async function currentIdentity(req){
  const session=await auth.api.getSession({headers:fromNodeHeaders(req.headers)});
  if(!session?.user)return null;
  const {rows}=await query(`insert into users(auth_subject,email,display_name)
    values($1,$2,$3)
    on conflict(auth_subject) do update set email=excluded.email,display_name=excluded.display_name,updated_at=now()
    returning id,auth_subject,email,display_name`,[session.user.id,session.user.email||null,session.user.name||session.user.email||'Team APP User']);
  return {session,user:rows[0]};
}

export async function requireIdentity(req,res,next){
  try{const identity=await currentIdentity(req);if(!identity)return res.status(401).json({error:'authentication_required'});req.teamApp=identity;next();}
  catch(err){next(err);}
}

export async function membershipFor(teamId,userId){
  const {rows}=await query(`select tm.role,t.id as team_id,t.organization_id,t.name as team_name
    from team_memberships tm join teams t on t.id=tm.team_id where tm.team_id=$1 and tm.user_id=$2`,[teamId,userId]);
  return rows[0]||null;
}

export function requireTeamRole(roles){
  return async (req,res,next)=>{
    try{
      const teamId=req.params.teamId||req.body?.teamId||req.query?.teamId;
      if(!teamId)return res.status(400).json({error:'team_id_required'});
      const membership=await membershipFor(teamId,req.teamApp.user.id);
      if(!membership)return res.status(403).json({error:'not_a_team_member'});
      if(roles?.length&&!roles.includes(membership.role))return res.status(403).json({error:'insufficient_role',role:membership.role});
      req.teamMembership=membership;next();
    }catch(err){next(err);}
  };
}

export async function listUserTeams(userId){
  const {rows}=await query(`select t.id,t.name,t.short_name,t.age_group,t.division,t.branding,t.home_location,t.default_layouts,
    tm.role,s.name as season_name,sp.code as sport_key,sp.name as sport_name
    from team_memberships tm
    join teams t on t.id=tm.team_id join seasons s on s.id=t.season_id join sports sp on sp.id=s.sport_id
    where tm.user_id=$1 order by t.created_at`,[userId]);
  return rows;
}
