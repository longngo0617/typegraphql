import * as bcrypt from "bcryptjs";
import { IsEmail, Length } from "class-validator";
import { IsEmailAlreadyExist } from "../utils/isEmailAlreadyExist";
import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  UseMiddleware,
} from "type-graphql";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { isAuth } from "../middleware/isAuth";
import { sendEmail } from "../utils/sendEmail";
import { v4 } from "uuid";

@InputType()
class RegisterInput {
  @Field()
  @Length(1, 255)
  firstName: string;

  @Field()
  @Length(1, 255)
  lastName: string;

  @Field()
  @IsEmail()
  @IsEmailAlreadyExist({ message: "email already in use" })
  email: string;

  @Field()
  password: string;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  async me(@Ctx() ctx: MyContext): Promise<User | undefined> {
    if (!ctx.req.session.userId) {
      return undefined;
    }

    return User.findOne(ctx.req.session.userId);
  }

  @UseMiddleware(isAuth)
  @Query(() => String)
  async hello() {
    return "hello world !";
  }

  @Mutation(() => User)
  async register(
    @Arg("registerInput")
    { firstName, lastName, email, password }: RegisterInput,
    @Ctx()
    { redis }: MyContext
  ): Promise<User> {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    }).save();

    const token = v4();

    await redis.set(token, user.id, "ex", 60 * 60 * 24); // 1 day expiration

    await sendEmail(email, `http://localhost:3000/confirm/${token}`);
    
    return user;
  }

  @Mutation(() => Boolean)
  async confirmUser(
    @Arg("token") token: string,
    @Ctx() {redis}: MyContext
  ): Promise<boolean> {
    const userId = await redis.get(token);

    if(!userId) {
      return false;
    }

    await User.update({ id: parseInt(userId,10) }, { confirmed: true });
    await redis.del(token);
    
    return true;
  }

  @Mutation(() => User, { nullable: true })
  async login(
    @Arg("email") email: string,
    @Arg("password") password: string,
    @Ctx() ctx: MyContext
  ): Promise<User | null> {
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return null;
    }
    const valid = await bcrypt.compare(password, user.password);

    if (!valid) {
      return null;
    }

    if (!user.confirmed) {
      return null;
    }

    ctx.req.session!.userId = user.id;

    return user;
  }
}
