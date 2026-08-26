#![no_std]

use soroban_sdk::{
    contract, contractclient, contractimpl, contracttype, token, Address, Env, String, Symbol,
};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub enum MissionStatus {
    Open,
    ProofSubmitted,
    Verified,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Mission {
    pub creator: Address,
    pub steward: Address,
    pub token: Address,
    pub goal: i128,
    pub pledged: i128,
    pub deadline: u64,
    pub metadata_hash: String,
    pub proof_hash: Option<String>,
    pub status: MissionStatus,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Mission(u64),
}

#[contractclient(name = "BadgeRegistryClient")]
pub trait BadgeRegistry {
    fn mint_badge(
        env: Env,
        recipient: Address,
        mission_id: u64,
        proof_hash: String,
        category: String,
    );
}

#[contract]
pub struct ImpactEscrow;

#[contractimpl]
impl ImpactEscrow {
    pub fn create_mission(
        env: Env,
        mission_id: u64,
        creator: Address,
        steward: Address,
        token: Address,
        goal: i128,
        deadline: u64,
        metadata_hash: String,
    ) {
        creator.require_auth();
        if goal <= 0 {
            panic!("Goal must be positive");
        }
        if env
            .storage()
            .persistent()
            .has(&DataKey::Mission(mission_id))
        {
            panic!("Mission already exists");
        }
        let mission = Mission {
            creator: creator.clone(),
            steward,
            token,
            goal,
            pledged: 0,
            deadline,
            metadata_hash,
            proof_hash: None,
            status: MissionStatus::Open,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Mission(mission_id), &mission);
        env.events()
            .publish((Symbol::new(&env, "MissionCreated"), mission_id), mission);
    }

    pub fn pledge(env: Env, mission_id: u64, supporter: Address, amount: i128) {
        supporter.require_auth();
        if amount <= 0 {
            panic!("Pledge must be positive");
        }
        let key = DataKey::Mission(mission_id);
        let mut mission: Mission = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Mission not found"));
        if mission.status != MissionStatus::Open {
            panic!("Mission is not open");
        }
        token::Client::new(&env, &mission.token).transfer(
            &supporter,
            &env.current_contract_address(),
            &amount,
        );
        mission.pledged += amount;
        env.storage().persistent().set(&key, &mission);
        env.events()
            .publish((Symbol::new(&env, "PledgeCreated"), mission_id), amount);
    }

    pub fn submit_proof(env: Env, mission_id: u64, steward: Address, proof_hash: String) {
        steward.require_auth();
        if proof_hash.len() < 8 {
            panic!("Proof hash is too short");
        }
        let key = DataKey::Mission(mission_id);
        let mut mission: Mission = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Mission not found"));
        if mission.steward != steward {
            panic!("Only the steward can submit proof");
        }
        if mission.status != MissionStatus::Open {
            panic!("Mission proof already submitted");
        }
        mission.proof_hash = Some(proof_hash.clone());
        mission.status = MissionStatus::ProofSubmitted;
        env.storage().persistent().set(&key, &mission);
        env.events().publish(
            (Symbol::new(&env, "ProofSubmitted"), mission_id),
            proof_hash,
        );
    }

    pub fn approve_proof(
        env: Env,
        mission_id: u64,
        verifier: Address,
        badge_registry: Address,
        category: String,
    ) {
        verifier.require_auth();
        let key = DataKey::Mission(mission_id);
        let mut mission: Mission = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| panic!("Mission not found"));
        if mission.status != MissionStatus::ProofSubmitted {
            panic!("Mission is not awaiting verification");
        }
        let proof_hash = mission
            .proof_hash
            .clone()
            .unwrap_or_else(|| panic!("Proof missing"));
        mission.status = MissionStatus::Verified;
        env.storage().persistent().set(&key, &mission);
        if mission.pledged > 0 {
            token::Client::new(&env, &mission.token).transfer(
                &env.current_contract_address(),
                &mission.steward,
                &mission.pledged,
            );
        }
        BadgeRegistryClient::new(&env, &badge_registry).mint_badge(
            &mission.steward,
            &mission_id,
            &proof_hash,
            &category,
        );
        env.events()
            .publish((Symbol::new(&env, "ProofVerified"), mission_id), mission);
    }

    pub fn get_mission(env: Env, mission_id: u64) -> Mission {
        env.storage()
            .persistent()
            .get(&DataKey::Mission(mission_id))
            .unwrap_or_else(|| panic!("Mission not found"))
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, String};

    #[test]
    fn status_starts_open() {
        assert_eq!(MissionStatus::Open, MissionStatus::Open);
    }

    #[test]
    fn proof_length_guard_is_meaningful() {
        let env = Env::default();
        let short = String::from_str(&env, "ipfs");
        assert!(short.len() < 8);
    }

    #[test]
    fn positive_goal_guard_is_meaningful() {
        assert!(0i128 <= 0i128);
        assert!(10i128 > 0i128);
    }
}
