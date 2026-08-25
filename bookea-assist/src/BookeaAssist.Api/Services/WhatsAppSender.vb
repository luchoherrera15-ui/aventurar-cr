Namespace Services

    ''' <summary>Implementación de IWhatsAppSender que envía mensajes de texto a través de la Cloud API de Meta.</summary>
    Public Class WhatsAppSender
        Implements IWhatsAppSender

        Private Const NombreHttpClient As String = "WhatsApp"

        Private ReadOnly _httpClientFactory As IHttpClientFactory
        Private ReadOnly _opcionesWhatsApp As WhatsAppOptions
        Private ReadOnly _logger As ILogger(Of WhatsAppSender)

        Public Sub New(httpClientFactory As IHttpClientFactory,
                       opcionesWhatsApp As IOptions(Of WhatsAppOptions),
                       logger As ILogger(Of WhatsAppSender))
            _httpClientFactory = httpClientFactory
            _opcionesWhatsApp = opcionesWhatsApp.Value
            _logger = logger
        End Sub

        Public Async Function EnviarTextoAsync(numeroDestino As String, texto As String) As Task Implements IWhatsAppSender.EnviarTextoAsync

            Dim envio As New WhatsAppEnvioTexto With {
                .Para = numeroDestino,
                .Texto = New WhatsAppTextoEnvio With {.Body = texto}
            }
            Dim json = System.Text.Json.JsonSerializer.Serialize(envio)

            Try
                Dim cliente = _httpClientFactory.CreateClient(NombreHttpClient)

                Using peticion As New HttpRequestMessage(HttpMethod.Post, $"https://graph.facebook.com/v20.0/{_opcionesWhatsApp.PhoneNumberId}/messages")
                    peticion.Headers.TryAddWithoutValidation("Authorization", $"Bearer {_opcionesWhatsApp.AccessToken}")
                    peticion.Content = New StringContent(json, System.Text.Encoding.UTF8, "application/json")

                    Using respuestaHttp = Await cliente.SendAsync(peticion)
                        If Not respuestaHttp.IsSuccessStatusCode Then
                            Dim cuerpoRespuesta = Await respuestaHttp.Content.ReadAsStringAsync()
                            _logger.LogError("La Cloud API de WhatsApp respondió {StatusCode}: {Cuerpo}", CInt(respuestaHttp.StatusCode), cuerpoRespuesta)
                        End If
                    End Using
                End Using
            Catch ex As Exception
                _logger.LogError(ex, "Falló el envío de un mensaje de WhatsApp a {NumeroDestino}.", numeroDestino)
            End Try

        End Function

    End Class

End Namespace
