import { fire } from "@/constants"
import fetcher from "@/utils/fetcher"
import {Reminder} from "@/interfaces/aether";

const requestWithAuth = <R = never>(accessToken: string, path: string, method?: string) =>
  fetcher<R>(`${fire.aetherApiUrl}/${path}`, {
    method: method ?? "GET",
    headers: {
      "User-Agent": "Fire Website",
      Authorization: `Bearer ${accessToken}`,
    },
  })

export const fetchCustomerId = async (accessToken: string) => {
  const json = await requestWithAuth<{ id: string }>(accessToken, `stripe/customer`)
  return json.id
}

export const createStripeCheckoutSession = async (accessToken: string, servers: number) => {
  const json = await requestWithAuth<{ sessionId: string }>(
    accessToken,
    `stripe/sessions/checkout?servers=${servers}`,
    "POST",
  )
  return json.sessionId
}

export const createStripePortalSession = async (accessToken: string) => {
  const json = await requestWithAuth<{ url: string }>(accessToken, `stripe/sessions/billing`, "POST")
  return json.url
}

export const fetchPremiumGuilds = async (accessToken: string) => {
  return await requestWithAuth<string[]>(accessToken, `guilds/premium`)
}

export const toggleGuildPremium = async (accessToken: string, guildId: string) => {
  return await requestWithAuth<string[]>(accessToken, `guilds/${guildId}/premium`, "PUT")
}

export const createDataArchive = async (accessToken: string) => {
  const json = await requestWithAuth<{ url: string }>(accessToken, `data/collect`, "POST")
  return json.url
}

export const fetchUserReminders = async (accessToken: string) => {
  return await requestWithAuth<Reminder[]>(accessToken, `user/reminders`)
}
