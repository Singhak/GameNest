import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, HydratedDocument } from "mongoose";
import { Role } from "src/common/enums/role.enum";

export type UserDocument = HydratedDocument<User>;
@Schema()
export class User extends Document {
    @Prop() uid: string;
    @Prop() email: string;
    @Prop() roles: Role[];
    @Prop() provider: string;
    @Prop() name: string;
    @Prop() phoneNumber: string;
    @Prop() password: string;

    @Prop({ default: [] }) refreshTokens: string[]; // Can store multiple tokens per device
}

export const UserSchema = SchemaFactory.createForClass(User)

