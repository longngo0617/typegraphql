import { UserResolver } from "../resolvers/user";
import { buildSchema } from "type-graphql";

export const createSchema = () =>
  buildSchema({
    resolvers: [UserResolver],
    authChecker: ({ context: { req } }) => {
      return !!req.session.userId;
    },
  });
