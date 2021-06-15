import "reflect-metadata";
import { ApolloServer } from "apollo-server-express";
import express from "express";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { UserResolver } from "./resolvers/user";
import session from "express-session";
import connectRedis from "connect-redis";
import cors from "cors";
import Redis from "ioredis";
import { COOKIE_NAME, __prod__ } from "./constants";
import { graphqlUploadExpress } from "graphql-upload";

const main = async () => {
  await createConnection();

  const schema = await buildSchema({
    resolvers: [UserResolver],
    authChecker: ({ context: { req } }) => {
      return !!req.session.userId;
    },
  });

  const apolloServer = new ApolloServer({
    schema,
    context: ({ req, res }) => ({ req, redis, res }),
    uploads:false,
    introspection:true,
  });

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        httpOnly: true,
        secure: __prod__,
        maxAge: 1000 * 60 * 60 * 24 * 7 * 365, // 7years
        sameSite: "lax",
      },
      name: COOKIE_NAME,
      secret: "aasdasdasd212312",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(graphqlUploadExpress({ maxFieldSize: 1000000, maxFiles: 10 }));

  apolloServer.applyMiddleware({ app });

  app.listen(4000, () => {
    console.log("server start on http://localhost:4000/graphql");
  });
};

main();
