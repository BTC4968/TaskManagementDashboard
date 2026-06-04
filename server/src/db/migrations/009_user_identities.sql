CREATE TABLE IF NOT EXISTS user_identities (
  auth0_sub text PRIMARY KEY,
  profile_auth0_sub text NOT NULL REFERENCES user_profiles(auth0_sub) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_identities_profile
  ON user_identities (profile_auth0_sub);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email_lookup
  ON user_profiles (lower(email));
