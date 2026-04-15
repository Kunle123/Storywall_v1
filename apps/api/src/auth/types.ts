/** Populated on `req.user` by JwtStrategy after a valid Bearer token. */
export type AuthenticatedCreator = {
  id: string;
  email: string;
  displayName: string | null;
};
