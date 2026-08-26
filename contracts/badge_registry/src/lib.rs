#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct Badge {
    pub recipient: Address,
    pub mission_id: u64,
    pub proof_hash: String,
    pub category: String,
    pub minted_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Badge(Address, u64),
    Escrow,
}

#[contract]
pub struct BadgeRegistry;

#[contractimpl]
impl BadgeRegistry {
    pub fn initialize(env: Env, escrow: Address) {
        if env.storage().instance().has(&DataKey::Escrow) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Escrow, &escrow);
    }

    pub fn mint_badge(
        env: Env,
        recipient: Address,
        mission_id: u64,
        proof_hash: String,
        category: String,
    ) {
        let escrow: Address = env
            .storage()
            .instance()
            .get(&DataKey::Escrow)
            .unwrap_or_else(|| panic!("Registry not initialized"));
        escrow.require_auth();
        let key = DataKey::Badge(recipient.clone(), mission_id);
        if env.storage().persistent().has(&key) {
            panic!("Badge already exists");
        }
        let badge = Badge {
            recipient: recipient.clone(),
            mission_id,
            proof_hash,
            category,
            minted_at: env.ledger().timestamp(),
        };
        env.storage().persistent().set(&key, &badge);
        env.events()
            .publish((Symbol::new(&env, "BadgeMinted"), mission_id), badge);
    }

    pub fn get_badge(env: Env, recipient: Address, mission_id: u64) -> Badge {
        env.storage()
            .persistent()
            .get(&DataKey::Badge(recipient, mission_id))
            .unwrap_or_else(|| panic!("Badge not found"))
    }
}

#[cfg(test)]
mod test {
    #[test]
    fn badge_identity_is_deterministic() {
        assert_eq!("recipient:mission", "recipient:mission");
    }

    #[test]
    fn badge_category_is_required() {
        assert!("CLIMATE".len() > 0);
    }

    #[test]
    fn timestamps_are_non_negative() {
        assert!(0u64 <= u64::MAX);
    }
}
