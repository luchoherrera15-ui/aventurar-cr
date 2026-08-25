Module Program

    Sub Main(args As String())

        Dim builder = WebApplication.CreateBuilder(args)

        builder.Services.Configure(Of WhatsAppOptions)(builder.Configuration.GetSection(WhatsAppOptions.SeccionConfiguracion))
        builder.Services.Configure(Of AnthropicOptions)(builder.Configuration.GetSection(AnthropicOptions.SeccionConfiguracion))

        builder.Services.AddHttpClient("WhatsApp")
        builder.Services.AddHttpClient("Anthropic")

        ' Singleton: mantienen estado en memoria (turnos creados, historial de conversación) mientras la app esté corriendo.
        builder.Services.AddSingleton(Of IBookeaClient, FakeBookeaClient)()
        builder.Services.AddSingleton(Of IConversationStore, InMemoryConversationStore)()

        ' Scoped: no guardan estado propio entre peticiones, solo dependen de servicios ya registrados.
        builder.Services.AddScoped(Of IWhatsAppSender, WhatsAppSender)()
        builder.Services.AddScoped(Of IConversationEngine, ClaudeConversationEngine)()

        builder.Services.AddControllers()

        Dim app = builder.Build()

        app.MapControllers()

        app.Run()

    End Sub

End Module
