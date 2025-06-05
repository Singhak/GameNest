import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schema/user.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { FirebaseModule } from 'src/firebase/firebase.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: User.name, schema: UserSchema },

  ])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService], // Export UsersService so AuthModule can use it
})
export class UsersModule { }
