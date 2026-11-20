export const ACCOUNT_FIELDS = `id email firstName lastName phone partnerNumber partnerCountry
  role status state profileCompleted isOrgRoot allowedActions assignableRoles`;

export const VIEWER_QUERY = "query { viewer { id email role state locale } }";
export const STRUCTURE_QUERY = `query { structure { depth account { ${ACCOUNT_FIELDS} } } }`;
export const MY_PROFILE_QUERY = `query { myProfile { id email firstName lastName phone
  partnerNumber partnerCountry state profileCompletedAt consentsAcceptedAt } }`;
export const MY_INVITATIONS_QUERY = `query { myInvitations { id kind recipientEmail
  recipientPhone locale createdAt expiresAt status } }`;
export const INVITATION_PREVIEW_QUERY = `query ($token: String!) {
  invitation(token: $token) { kind recipientEmail recipientPhone locale expiresAt } }`;

export const LOGIN_MUTATION = `mutation ($email: String!, $password: String!) {
  login(email: $email, password: $password) { id } }`;
export const LOGOUT_MUTATION = "mutation { logout }";
export const REGISTER_MUTATION = `mutation ($input: RegisterInput!) {
  register(input: $input) { id } }`;
export const UPDATE_PROFILE_MUTATION = `mutation ($input: UpdateProfileInput!) {
  updateMyProfile(input: $input) { id } }`;
export const CREATE_INVITATION_MUTATION = `mutation ($input: CreateInvitationInput!) {
  createInvitation(input: $input) { url invitation { id } } }`;
export const REVOKE_INVITATION_MUTATION = `mutation ($id: ID!) {
  revokeInvitation(id: $id) { id } }`;
