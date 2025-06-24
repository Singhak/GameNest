import { forwardRef, Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Notification, NotificationSchema } from './notification.schema';
import { UsersModule } from 'src/users/users.module';
import { BookingModule } from 'src/booking/booking.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Notification.name, schema: NotificationSchema }
        ]),
        forwardRef(() => UsersModule),
        forwardRef(() => BookingModule),
    ],
    controllers: [NotificationController],
    providers: [NotificationService],
    exports: [NotificationService],
})
export class NotificationModule { }
