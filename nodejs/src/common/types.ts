/**
 * Copyright [2018] [Dario Alessandro Lencina Talarico]
 * Licensed under the Apache License, Version 2.0 (the "License");
 * y ou may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Client } from "pg";

export interface Location {
    lat: number;
    lon: number;
    creationTimestamp: string;
}

export interface LocationRequest {
    returnFriendLocations: boolean;
    location: Location;
}

export interface GetDeviceLocationsRequest {
    username: string;
    deviceIds: Array<string>;
    startTime: string;
    endTime: string;
}

export interface GetHistoricalLocationRequest {
    username: string;
    following: string;
    startTime: string;
    endTime: string;
}

export interface LocationRequestWithDeviceOwner extends LocationRequest {
    username: string;
    deviceId: string;
}

export interface RejectInvitation {
    username: string;
    id: string;
}

export interface CancelInvitation {
    username: string;
    id: string;
}

export interface AcceptInvitation {
    username: string;
    id: string;
}

interface BaseInvitationRequest<A> {
    [x: string]: any;
    type: string;
    invitation: A;
}

export interface EmailInvitationRequest<A> extends BaseInvitationRequest<A> {
    targetEmail: string;
}

export interface PhoneInvitationRequest<A> extends BaseInvitationRequest<A> {
    targetPhoneNumber: string;
}

export interface CreateInvitation<A> {
    username: string;
    invitation: EmailInvitationRequest<A> | PhoneInvitationRequest<A>;
}

export interface ValidateInvitation<A> {
    username: string;
    invitation: EmailInvitationRequest<A> | PhoneInvitationRequest<A>;
}

export enum InvitationType {
    Follower = "follower",
}

export enum AccessType {
    EmergencyOnly = "EmergencyOnly",
    Permanent = "Permanent",
}

export enum UserState {
    Emergency = "Emergency",
    Normal = "Normal",
}

export interface FollowerInvitation {
    accessType: AccessType;
    isEmergencyContact: boolean;
}

interface BasePendingInvitation<A> {
    creatorUsername: string;
    creator: UserInfo;
    status: string;
    invitation: A;
    type: string;
    creationTimestamp: string;
    updateTimestamp: string;
    id: string;
}

export interface EmailPendingInvitation<A> extends BasePendingInvitation<A> {
    targetEmail: string;
}

export interface PhonePendingInvitation<A> extends BasePendingInvitation<A> {
    targetPhoneNumber: string;
}

export interface GetInvitationsResponse<A> {
    sent: (EmailPendingInvitation<A> | PhonePendingInvitation<A>)[];
    received: (EmailPendingInvitation<A> | PhonePendingInvitation<A>)[];
}

export interface Device {
    username: string;
    deviceId: string;
}

export interface DeviceAccessRequest {
    username: string;
    id: string;
}

export interface UpdateAccessRequest {
    username: string;
    id: string;
    guestId: string;
}

export interface DeleteGeofence {
    geofenceId: string;
    owner: string;
}
export interface SubscribeGeofence {
    geofenceId: string;
    subscriber: string;
}

export interface CreateGeofence {
    address: string;
    username: string;
    lat: number;
    lon: number;
    name: string;
    radius: number;
}

export interface GetGeofencesResponse {
    mine: Geofence[];
    subscribed: Geofence[];

    unsubscribed: Geofence[];
}

export interface Geofence {
    active: Boolean;
    address: string;
    username: string;
    id: number;
    lat: number;
    lon: number;
    name: string;
    radius: number;
}

export interface APIResponse<T> {
    success: boolean;
    result: T | undefined;
}

export interface Message {
    message: string;
}

export interface DBClientWithConnection {
    readonly connection: Client;
}

export interface Username {
    username: string;
}

export interface Device2 {
    username: string;
    deviceId: string;
    os: string;
    osVersion: string;
    model: string;
    appVersion: string | undefined;
}

export interface DevicePushNotificationRegistration {
    pushToken: string;
    deviceId: string;
    username: string;
}

export interface DeviceId {
    deviceId: String;
}

export interface Credentials {
    username: string;
    password: string;
}

export interface BaseRegistration {
    username: string;
    firstName: string;
    lastName: string;
    picture: string | undefined;
    publicKey: string;
    language: string;
}

export interface UserInfo {
    email: string | undefined;
    phoneNumber: string | undefined;
    username: string;
    firstName: string;
    lastName: string;
    picture: string | undefined;
    language: string;
}

export interface PasswordResetMetadata {
    username: string;
    email: string;
    requestId: string;
    firstName: string;
}

export interface Telemetry {
    timestamp: string;
    location: Location;
}

export interface DeviceWithTelemetry {
    device: Device2;
    telemetry: Telemetry;
}

export interface Follower {
    userDetails: UserInfo;
}

export interface FollowingEntry {
    userDetails: UserInfo;
    devices: DeviceWithTelemetry[];
}

export interface NotificationRecipient {
    email: string;
    username: string;
}

export interface Notifications {
    emails: Email[];
    pushNotifications: PushNotification[];
}

export interface PushNotification {
    deviceId: string;
    data: PushNotificationMessage;
}

export interface PushNotificationMessage {
    title: string;
    body: string;
}

export interface Sms {
    to: string;
    body: string;
}

export interface Email {
    username: string | undefined;
    email: string;
    templateId: string;
    dynamicTemplateData: DynamicEmailTemplateData;
}

export interface DynamicEmailTemplateData {
    title: string;
    body: string;
    linkTitle: string;
    picture: string | undefined;
    link: string | undefined;
}

export interface UserDetails extends UserInfo {
    settings: {
        followersNeededToDeclareEmergency: number;
    };
    userState: {
        selfPerceptionState: UserState;
        followersPerception: FollowerPerception[] | [];
    };
}

export interface FollowerPerception {
    username: string;
    perception: UserState;
}

export interface EmailVerificationRequest {
    email: String;
    verificationId: String;
    verificationCode: String;
    expirationTimestamp: String;
}

export interface SmsVerificationRequest {
    expirationTimestamp: String;
    phoneNumber: String;
    verificationCode: String;
    verificationId: String;
}
