export const ACCOUNT_FIELDS = `id email firstName lastName phone partnerNumber partnerCountry
  role status state profileCompleted recommenderId isOrgRoot detachedOrg promotedAt promotedBy removed allowedActions assignableRoles`;

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

export const ACCOUNT_QUERY = `query ($id: ID!) { account(id: $id) { ${ACCOUNT_FIELDS} } }`;
export const CANDIDATES_QUERY = `query ($id: ID!) {
  recommenderCandidates(id: $id) { id email firstName lastName depth } }`;
export const ACTIVATE_MUTATION = "mutation ($id: ID!) { activateAccount(id: $id) { id } }";
export const DEACTIVATE_MUTATION = "mutation ($id: ID!) { deactivateAccount(id: $id) { id } }";
export const CHANGE_ROLE_MUTATION = `mutation ($id: ID!, $role: Role!) {
  changeAccountRole(id: $id, role: $role) { id } }`;
export const CHANGE_STATUS_MUTATION = `mutation ($id: ID!, $status: PartnerStatus!) {
  changeAccountStatus(id: $id, status: $status) { id } }`;
export const UPDATE_ACCOUNT_DATA_MUTATION = `mutation ($id: ID!, $input: UpdateAccountDataInput!) {
  updateAccountData(id: $id, input: $input) { id } }`;
export const UPDATE_PARTNER_NUMBER_MUTATION = `mutation ($id: ID!, $input: PartnerNumberInput!) {
  updatePartnerNumber(id: $id, input: $input) { id } }`;
export const CHANGE_RECOMMENDER_MUTATION = `mutation ($id: ID!, $recommenderId: ID!) {
  changeAccountRecommender(id: $id, recommenderId: $recommenderId) { id } }`;
export const REMOVE_ACCOUNT_MUTATION =
  "mutation ($id: ID!) { removeAccountFromStructure(id: $id) }";
export const PROMOTE_MUTATION = "mutation ($id: ID!) { promoteAccount(id: $id) { id } }";
